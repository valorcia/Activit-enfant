"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe";
import { sendOrderConfirmation } from "@/lib/orders/notify";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function fail(e: unknown): Result {
  return { ok: false, error: e instanceof Error ? e.message : "Erreur inattendue" };
}

export async function resendConfirmationAction(orderId: string): Promise<Result> {
  try {
    const user = await assertPermission("orders:read");
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order || (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED")) return { ok: false, error: "La commande n'est pas payée" };
    await sendOrderConfirmation(orderId);
    await audit({ userId: user.id, action: "order.resend_confirmation", entity: "order", entityId: orderId });
    return { ok: true, message: "Email de confirmation renvoyé" };
  } catch (e) { return fail(e); }
}

export async function toggleEntitlementAction(entitlementId: string, revoke: boolean): Promise<Result> {
  try {
    const user = await assertPermission("orders:refund");
    const ent = await prisma.downloadEntitlement.update({ where: { id: entitlementId }, data: { revokedAt: revoke ? new Date() : null } });
    await audit({ userId: user.id, action: revoke ? "entitlement.revoke" : "entitlement.restore", entity: "entitlement", entityId: entitlementId, data: { orderId: ent.orderId } });
    revalidatePath(`/admin/commandes/${ent.orderId}`);
    return { ok: true, message: revoke ? "Accès révoqué" : "Accès réactivé" };
  } catch (e) { return fail(e); }
}

export async function resetDownloadCountAction(entitlementId: string): Promise<Result> {
  try {
    const user = await assertPermission("orders:refund");
    const ent = await prisma.downloadEntitlement.update({ where: { id: entitlementId }, data: { downloadCount: 0 } });
    await audit({ userId: user.id, action: "entitlement.reset_count", entity: "entitlement", entityId: entitlementId });
    revalidatePath(`/admin/commandes/${ent.orderId}`);
    return { ok: true, message: "Compteur réinitialisé" };
  } catch (e) { return fail(e); }
}

const refundSchema = z.object({ orderId: z.string().min(1), amountCents: z.coerce.number().int().min(1).optional(), reason: z.string().max(300).optional() });

/** Remboursement via Stripe. La commande est mise à jour par le webhook charge.refunded ; le Refund local est enregistré immédiatement. */
export async function refundOrderAction(raw: { orderId: string; amountCents?: number; reason?: string }): Promise<Result> {
  try {
    const user = await assertPermission("orders:refund");
    const input = refundSchema.parse(raw);
    const order = await prisma.order.findUnique({ where: { id: input.orderId } });
    if (!order) return { ok: false, error: "Commande introuvable" };
    if (!order.stripePaymentIntentId) return { ok: false, error: "Aucun paiement Stripe associé" };
    if (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED") return { ok: false, error: "Cette commande ne peut pas être remboursée" };
    const remaining = order.totalCents - order.refundedCents;
    const amount = input.amountCents ?? remaining;
    if (amount > remaining) return { ok: false, error: `Montant supérieur au reste remboursable (${(remaining / 100).toFixed(2)} €)` };
    const refund = await getStripe().refunds.create({ payment_intent: order.stripePaymentIntentId, amount, reason: "requested_by_customer", metadata: { orderId: order.id, adminUserId: user.id, note: input.reason ?? "" } });
    await prisma.refund.upsert({
      where: { stripeRefundId: refund.id },
      create: { orderId: order.id, stripeRefundId: refund.id, amountCents: amount, reason: input.reason, createdById: user.id },
      update: { reason: input.reason, createdById: user.id },
    });
    // Mise à jour optimiste du statut (confirmée ensuite par le webhook)
    const refundedCents = order.refundedCents + amount;
    const full = refundedCents >= order.totalCents;
    await prisma.order.update({ where: { id: order.id }, data: { refundedCents, status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    if (full) await prisma.downloadEntitlement.updateMany({ where: { orderId: order.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ userId: user.id, action: "order.refund", entity: "order", entityId: order.id, data: { amount, stripeRefundId: refund.id, reason: input.reason ?? null } });
    revalidatePath(`/admin/commandes/${order.id}`);
    revalidatePath("/admin/commandes");
    return { ok: true, message: `Remboursement de ${(amount / 100).toFixed(2)} € émis` };
  } catch (e) { return fail(e); }
}
