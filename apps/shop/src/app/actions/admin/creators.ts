"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { revalidateCatalog } from "@/lib/catalog";
import { fail, handleActionError, succeed, type ActionResult } from "@/lib/admin/action-result";
import { inviteCreator, linkSubmissionToProduct, moderateSubmission } from "@/lib/creators/service";
import { sendCreatorInvite, sendPayoutPaid } from "@/lib/creators/notify";
import { cancelPendingPayout, markPayoutPaid, preparePayouts } from "@/lib/creators/payouts";
import { saveCreatorSettings } from "@/lib/creators/settings";
import { confirmDueCommissions } from "@/lib/creators/commissions";

function revalidateCreators() {
  revalidatePath("/admin/createurs", "layout");
}

export async function inviteCreatorAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertPermission("creators:write");
    const c = await inviteCreator(raw);
    await audit({ userId: user.id, actor: user.email, action: "creator.invite", entity: "creator", entityId: c.id });
    revalidateCreators();
    return succeed({ id: c.id });
  } catch (e) { return handleActionError(e); }
}

export async function resendInviteAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("creators:write");
    const c = await prisma.creator.findUniqueOrThrow({ where: { id } });
    if (c.status === "SUSPENDED") return fail("Créatrice suspendue : réactivez-la d'abord");
    await sendCreatorInvite(c);
    await audit({ userId: user.id, actor: user.email, action: "creator.invite.resend", entity: "creator", entityId: id });
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

const updateSchema = z.object({
  status: z.enum(["INVITED", "ACTIVE", "SUSPENDED"]).optional(),
  defaultRateBp: z.number().int().min(0).max(9000).nullable().optional(),
});

export async function updateCreatorAction(id: string, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("creators:write");
    const input = updateSchema.parse(raw);
    const before = await prisma.creator.findUniqueOrThrow({ where: { id } });
    if (input.status === "ACTIVE" && !before.contractVersion) return fail("La créatrice doit d'abord accepter le contrat (statut « invitée » en attendant)");
    await prisma.creator.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.defaultRateBp !== undefined ? { defaultRateBp: input.defaultRateBp } : {}),
        // Suspension : toutes les sessions ouvertes sont fermées
        ...(input.status === "SUSPENDED" && before.status !== "SUSPENDED" ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    await audit({ userId: user.id, actor: user.email, action: "creator.update", entity: "creator", entityId: id, data: input });
    revalidateCreators();
    revalidateCatalog();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

/** Taux propre à un produit (surcharge du taux de la créatrice). */
export async function setProductCreatorRateAction(productId: string, rateBp: number | null): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("creators:write");
    const r = z.number().int().min(0).max(9000).nullable().parse(rateBp);
    await prisma.product.update({ where: { id: productId }, data: { creatorRateBp: r } });
    await audit({ userId: user.id, actor: user.email, action: "creator.product.rate", entity: "product", entityId: productId, data: { rateBp: r } });
    revalidateCreators();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

const moderationSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED", "CHANGES_REQUESTED"]),
  comment: z.string().max(3000).optional().nullable(),
  rateBp: z.number().int().min(0).max(9000).nullable().optional(),
});

export async function moderateSubmissionAction(id: string, raw: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    const user = await assertPermission("creators:write");
    const input = moderationSchema.parse(raw);
    const sub = await moderateSubmission(id, input, { userId: user.id });
    await audit({ userId: user.id, actor: user.email, action: `creator.submission.${input.decision.toLowerCase()}`, entity: "creatorSubmission", entityId: id });
    revalidateCreators();
    return succeed({ status: sub.status });
  } catch (e) { return handleActionError(e); }
}

/** Lien manuel proposition ↔ produit (si le produit n'a pas été créé par le studio). */
export async function linkSubmissionProductAction(id: string, productRef: string): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("creators:write");
    const ref = productRef.trim();
    const product = await prisma.product.findFirst({ where: { OR: [{ id: ref }, { slug: ref }] }, select: { id: true, slug: true } });
    if (!product) return fail("Produit introuvable (identifiant ou slug)");
    await linkSubmissionToProduct(id, product.id);
    await audit({ userId: user.id, actor: user.email, action: "creator.submission.link", entity: "creatorSubmission", entityId: id, data: { productId: product.id } });
    revalidateCatalog([product.slug]);
    revalidateCreators();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function confirmCommissionsAction(ids: string[]): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await assertPermission("creators:write");
    const list = z.array(z.string().min(1)).max(500).parse(ids);
    const r = await prisma.commissionEntry.updateMany({ where: { id: { in: list }, status: "PENDING" }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
    await audit({ userId: user.id, actor: user.email, action: "creator.commissions.confirm", entity: "commissionEntry", data: { count: r.count } });
    revalidateCreators();
    return succeed({ count: r.count });
  } catch (e) { return handleActionError(e); }
}

export async function confirmDueCommissionsAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await assertPermission("creators:write");
    const count = await confirmDueCommissions();
    await audit({ userId: user.id, actor: user.email, action: "creator.commissions.confirm_due", entity: "commissionEntry", data: { count } });
    revalidateCreators();
    return succeed({ count });
  } catch (e) { return handleActionError(e); }
}

export async function cancelCommissionAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("creators:write");
    const e = await prisma.commissionEntry.findUniqueOrThrow({ where: { id }, include: { payout: { select: { status: true } } } });
    if (e.status === "PAID" || e.payout?.status === "PAID") return fail("Commission déjà payée : elle ne peut plus être annulée");
    await prisma.commissionEntry.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), payoutId: null } });
    if (e.payoutId) {
      const agg = await prisma.commissionEntry.aggregate({ where: { payoutId: e.payoutId, status: { not: "CANCELLED" } }, _sum: { amountCents: true } });
      await prisma.creatorPayout.update({ where: { id: e.payoutId }, data: { totalCents: agg._sum.amountCents ?? 0 } });
    }
    await audit({ userId: user.id, actor: user.email, action: "creator.commission.cancel", entity: "commissionEntry", entityId: id });
    revalidateCreators();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function preparePayoutsAction(): Promise<ActionResult<{ created: number; updated: number; below: number; period: string }>> {
  try {
    const user = await assertPermission("creators:payouts");
    const r = await preparePayouts();
    await audit({ userId: user.id, actor: user.email, action: "creator.payouts.prepare", entity: "creatorPayout", entityId: r.period, data: { created: r.created, updated: r.updated } });
    revalidateCreators();
    return succeed({ created: r.created, updated: r.updated, below: r.belowThreshold.length, period: r.period });
  } catch (e) { return handleActionError(e); }
}

export async function markPayoutPaidAction(id: string, reference: string): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("creators:payouts");
    const payout = await markPayoutPaid(id, reference, { userId: user.id });
    await audit({ userId: user.id, actor: user.email, action: "creator.payout.paid", entity: "creatorPayout", entityId: id });
    const creator = await prisma.creator.findUnique({ where: { id: payout.creatorId }, select: { email: true } });
    if (creator) await sendPayoutPaid(creator, payout).catch(() => undefined);
    revalidateCreators();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function cancelPayoutAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("creators:payouts");
    await cancelPendingPayout(id);
    await audit({ userId: user.id, actor: user.email, action: "creator.payout.cancel", entity: "creatorPayout", entityId: id });
    revalidateCreators();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function saveCreatorSettingsAction(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await assertPermission("creators:payouts");
    await saveCreatorSettings(raw);
    await audit({ userId: user.id, actor: user.email, action: "settings.update", entity: "siteSetting", entityId: "creators" });
    revalidateCreators();
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}
