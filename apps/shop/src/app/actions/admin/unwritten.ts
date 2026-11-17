"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { fail, handleActionError, succeed, type ActionResult } from "@/lib/admin/action-result";
import { revalidateSites } from "@/lib/sites";
import { SUPPORTED_LOCALES } from "@/lib/unwritten/constants";
import { readUnwrittenConfig, unwrittenConfigSchema } from "@/lib/unwritten/config";
import { resendGiftLink, sendBookReady } from "@/lib/unwritten/notify";
import { PersonalItemError, requeueItem } from "@/lib/unwritten/orders";
import { lintDefinition } from "@/lib/unwritten/questionnaire/engine";
import { parseDefinition } from "@/lib/unwritten/questionnaire/schema";

/** Administration UNWRITTEN (en français). Toutes les actions sont journalisées sans donnée personnelle. */

function handle(e: unknown): ActionResult<never> {
  if (e instanceof PersonalItemError) return fail(e.message);
  return handleActionError(e);
}

// ---------------------------------------------------------------------------
// Livres commandés
// ---------------------------------------------------------------------------

export async function resendGiftLinkAction(itemId: string): Promise<ActionResult<{ to: string }>> {
  try {
    const user = await assertPermission("orders:refund");
    const to = await resendGiftLink(itemId);
    await audit({ userId: user.id, action: "personal.gift.resend", entity: "personalOrderItem", entityId: itemId, data: { to } });
    revalidatePath(`/admin/unwritten/${itemId}`);
    return succeed({ to: to === "recipient" ? "au destinataire" : "à l'acheteur (adresse du destinataire inconnue)" });
  } catch (e) {
    return handle(e);
  }
}

export async function requeueItemAction(itemId: string): Promise<ActionResult> {
  try {
    const user = await assertPermission("orders:refund");
    await requeueItem(itemId);
    await audit({ userId: user.id, action: "personal.requeue", entity: "personalOrderItem", entityId: itemId });
    revalidatePath(`/admin/unwritten/${itemId}`);
    return succeed(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function resendBookReadyAction(itemId: string): Promise<ActionResult> {
  try {
    const user = await assertPermission("orders:refund");
    const item = await prisma.personalOrderItem.findUnique({ where: { id: itemId }, select: { status: true } });
    if (item?.status !== "DELIVERED") return fail("Le livre n'est pas encore livré");
    await sendBookReady(itemId);
    await audit({ userId: user.id, action: "personal.delivery.resend", entity: "personalOrderItem", entityId: itemId });
    await prisma.personalOrderItem.update({ where: { id: itemId }, data: { remindedAt: new Date() } });
    return succeed(undefined);
  } catch (e) {
    return handle(e);
  }
}

// ---------------------------------------------------------------------------
// Questionnaires (JSON validé, versions immuables)
// ---------------------------------------------------------------------------

export type DefinitionCheck = { ok: boolean; errors: string[]; warnings: string[]; questions?: { min: number; max: number } };

export async function checkDefinitionAction(json: string): Promise<DefinitionCheck> {
  await assertPermission("products:write");
  const parsed = parseDefinition(json);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: [] };
  const lint = lintDefinition(parsed.definition);
  return { ok: true, errors: [], warnings: lint.warnings, questions: { min: lint.min, max: lint.max } };
}

/** Enregistre une nouvelle version (brouillon), et la publie immédiatement si demandé. */
export async function saveQuestionnaireAction(productId: string, json: string, opts: { publish: boolean; note?: string }): Promise<ActionResult<{ version: number }>> {
  try {
    const user = await assertPermission("products:write");
    const parsed = parseDefinition(json);
    if (!parsed.ok) return fail(`Définition invalide : ${parsed.errors.slice(0, 5).join(" · ")}`);
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, personalization: { select: { productId: true } } } });
    if (!product?.personalization) return fail("Produit personnalisé introuvable");
    const created = await prisma.$transaction(async (tx) => {
      const last = await tx.questionnaire.aggregate({ where: { productId }, _max: { version: true } });
      const version = (last._max.version ?? 0) + 1;
      if (opts.publish) await tx.questionnaire.updateMany({ where: { productId, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
      return tx.questionnaire.create({
        data: { productId, version, status: opts.publish ? "ACTIVE" : "DRAFT", definition: parsed.definition as unknown as Prisma.InputJsonValue, note: opts.note?.slice(0, 200) || null, createdBy: user.email, publishedAt: opts.publish ? new Date() : null },
      });
    });
    await audit({ userId: user.id, action: opts.publish ? "questionnaire.publish" : "questionnaire.draft", entity: "questionnaire", entityId: created.id, data: { productId, version: created.version } });
    revalidatePath("/admin/unwritten/questionnaires", "layout");
    return succeed({ version: created.version });
  } catch (e) {
    return handle(e);
  }
}

/** Active une version existante (les brouillons en cours gardent la version avec laquelle ils ont commencé). */
export async function publishQuestionnaireAction(questionnaireId: string): Promise<ActionResult> {
  try {
    const user = await assertPermission("products:write");
    const q = await prisma.questionnaire.findUniqueOrThrow({ where: { id: questionnaireId } });
    const parsed = parseDefinition(q.definition);
    if (!parsed.ok) return fail("Cette version n'est plus valide : corrigez-la dans une nouvelle version");
    await prisma.$transaction([
      prisma.questionnaire.updateMany({ where: { productId: q.productId, status: "ACTIVE" }, data: { status: "ARCHIVED" } }),
      prisma.questionnaire.update({ where: { id: q.id }, data: { status: "ACTIVE", publishedAt: new Date() } }),
    ]);
    await audit({ userId: user.id, action: "questionnaire.publish", entity: "questionnaire", entityId: q.id, data: { productId: q.productId, version: q.version } });
    revalidatePath("/admin/unwritten/questionnaires", "layout");
    return succeed(undefined);
  } catch (e) {
    return handle(e);
  }
}

// ---------------------------------------------------------------------------
// Réglages de la marque : langues ouvertes, conservation, prix par produit
// ---------------------------------------------------------------------------

const brandSchema = z.object({
  openLocales: z.array(z.enum(SUPPORTED_LOCALES)).min(1, "Au moins une langue ouverte"),
  defaultLocale: z.enum(SUPPORTED_LOCALES),
  config: unwrittenConfigSchema,
});

export async function saveBrandSettingsAction(siteId: string, raw: unknown): Promise<ActionResult> {
  try {
    const user = await assertPermission("settings:write");
    const input = brandSchema.parse(raw);
    if (!input.openLocales.includes(input.defaultLocale)) return fail("La langue par défaut doit être ouverte");
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { kind: true, settings: true } });
    if (site?.kind !== "PERSONALIZED") return fail("Marque personnalisée introuvable");
    const settings = { ...((site.settings ?? {}) as Record<string, unknown>), unwritten: { ...readUnwrittenConfig(site.settings), ...input.config } };
    await prisma.site.update({ where: { id: siteId }, data: { locales: input.openLocales, defaultLocale: input.defaultLocale, settings: settings as Prisma.InputJsonValue } });
    await audit({ userId: user.id, action: "brand.settings", entity: "site", entityId: siteId, data: { locales: input.openLocales, defaultLocale: input.defaultLocale } });
    revalidateSites();
    revalidatePath("/admin/unwritten/reglages");
    return succeed(undefined);
  } catch (e) {
    return handle(e);
  }
}

const productSchema = z.object({
  prices: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().int().min(50, "Prix minimum : 0,50").max(1_000_000)),
  deliveryDaysMin: z.number().int().min(0).max(60),
  deliveryDaysMax: z.number().int().min(0).max(60),
  pagesMin: z.number().int().min(1).max(500).nullable(),
  pagesMax: z.number().int().min(1).max(500).nullable(),
});

/** Prix fixés par devise ; le prix de la devise du produit est aussi recopié dans Product.priceCents. */
export async function saveProductSettingsAction(productId: string, raw: unknown): Promise<ActionResult> {
  try {
    const user = await assertPermission("products:write");
    const input = productSchema.parse(raw);
    if (input.deliveryDaysMax < input.deliveryDaysMin) return fail("Le délai maximal doit être supérieur au délai minimal");
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { currency: true, personalization: { select: { productId: true } } } });
    if (!product?.personalization) return fail("Produit personnalisé introuvable");
    const main = input.prices[product.currency.toUpperCase()];
    await prisma.$transaction([
      prisma.personalizedProduct.update({ where: { productId }, data: { prices: input.prices, deliveryDaysMin: input.deliveryDaysMin, deliveryDaysMax: input.deliveryDaysMax, pagesMin: input.pagesMin, pagesMax: input.pagesMax } }),
      ...(main ? [prisma.product.update({ where: { id: productId }, data: { priceCents: main } })] : []),
    ]);
    await audit({ userId: user.id, action: "product.personalized.settings", entity: "product", entityId: productId, data: { prices: input.prices } });
    revalidatePath("/admin/unwritten/reglages");
    return succeed(undefined);
  } catch (e) {
    return handle(e);
  }
}
