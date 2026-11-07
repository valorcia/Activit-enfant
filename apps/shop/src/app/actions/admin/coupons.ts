"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";

const optionalInt = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).optional());
const optionalDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional());

export const couponSchema = z.object({
  code: z.string().min(3).max(40).transform((s) => s.trim().toUpperCase().replace(/\s+/g, "")),
  description: z.string().max(200).optional().nullable(),
  type: z.enum(["PERCENT", "FIXED"]),
  percentOff: optionalInt,
  amountOffCents: optionalInt,
  minSubtotalCents: optionalInt,
  maxUses: optionalInt,
  startsAt: optionalDate,
  endsAt: optionalDate,
  isActive: z.coerce.boolean().default(true),
}).superRefine((c, ctx) => {
  if (c.type === "PERCENT" && (!c.percentOff || c.percentOff < 1 || c.percentOff > 100)) ctx.addIssue({ code: "custom", path: ["percentOff"], message: "Pourcentage entre 1 et 100" });
  if (c.type === "FIXED" && !c.amountOffCents) ctx.addIssue({ code: "custom", path: ["amountOffCents"], message: "Montant requis" });
});

export type CouponResult = { ok: true; id: string } | { ok: false; error: string; fields?: Record<string, string> };

function zodFields(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0] ?? "_")] = i.message;
  return out;
}

export async function saveCouponAction(id: string | null, raw: unknown): Promise<CouponResult> {
  try {
    const user = await assertPermission("coupons:write");
    const parsed = couponSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Formulaire invalide", fields: zodFields(parsed.error) };
    const d = parsed.data;
    const data = {
      code: d.code, description: d.description ?? null, type: d.type,
      percentOff: d.type === "PERCENT" ? d.percentOff ?? null : null,
      amountOffCents: d.type === "FIXED" ? d.amountOffCents ?? null : null,
      minSubtotalCents: d.minSubtotalCents ?? null, maxUses: d.maxUses ?? null,
      startsAt: d.startsAt ?? null, endsAt: d.endsAt ?? null, isActive: d.isActive,
    };
    const existing = await prisma.coupon.findUnique({ where: { code: d.code } });
    if (existing && existing.id !== id) return { ok: false, error: "Ce code existe déjà", fields: { code: "Code déjà utilisé" } };
    // Si les paramètres changent, le coupon Stripe synchronisé doit être recréé
    const coupon = id
      ? await prisma.coupon.update({ where: { id }, data: { ...data, stripeCouponId: null } })
      : await prisma.coupon.create({ data });
    await audit({ userId: user.id, action: id ? "coupon.update" : "coupon.create", entity: "coupon", entityId: coupon.id, data: { code: coupon.code } });
    revalidatePath("/admin/codes-promo");
    return { ok: true, id: coupon.id };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}

export async function deleteCouponAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await assertPermission("coupons:write");
    const used = await prisma.order.count({ where: { couponId: id } });
    if (used > 0) {
      await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    } else {
      await prisma.coupon.delete({ where: { id } });
    }
    await audit({ userId: user.id, action: used > 0 ? "coupon.deactivate" : "coupon.delete", entity: "coupon", entityId: id });
    revalidatePath("/admin/codes-promo");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}
