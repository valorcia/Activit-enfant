"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import {
  deactivateEtsyListing, findEtsyAccountForSite, importEtsySales, publishProductToEtsy, searchEtsyTaxonomy, syncEtsyListings,
  etsySettingsFor, EtsyError, type TaxonomyNode,
} from "@/lib/channels/etsy";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): Result<never> {
  if (!(e instanceof EtsyError)) console.error("[etsy]", e);
  return { ok: false, error: e instanceof Error ? e.message : "Erreur inattendue" };
}
function revalidate(productId?: string) {
  revalidatePath("/admin/marketing/etsy");
  revalidatePath("/admin/marketing/connecteurs");
  if (productId) revalidatePath(`/admin/produits/${productId}`);
}

/** Publie (ou met à jour) un produit sur Etsy. */
export async function publishEtsyAction(productId: string, state?: "draft" | "active"): Promise<Result<{ url: string | null; state: string; warnings: string[]; created: boolean }>> {
  try {
    const user = await assertPermission("products:publish");
    const r = await publishProductToEtsy(productId, { state });
    await audit({ userId: user.id, action: r.created ? "etsy.create" : "etsy.update", entity: "product", entityId: productId, data: { listingId: r.listing.etsyListingId, state: r.listing.state } });
    revalidate(productId);
    return { ok: true, data: { url: r.listing.url, state: r.listing.state, warnings: r.warnings, created: r.created } };
  } catch (e) { return fail(e); }
}

export async function deactivateEtsyAction(listingRowId: string): Promise<Result> {
  try {
    const user = await assertPermission("products:publish");
    const row = await deactivateEtsyListing(listingRowId);
    await audit({ userId: user.id, action: "etsy.deactivate", entity: "product", entityId: row.productId, data: { listingId: row.etsyListingId } });
    revalidate(row.productId);
    return { ok: true, data: undefined };
  } catch (e) { return fail(e); }
}

const overridesSchema = z.object({
  title: z.string().max(140).optional().nullable(),
  description: z.string().max(60000).optional().nullable(),
  tags: z.array(z.string().max(40)).max(13).optional().nullable(),
  priceEuros: z.string().max(12).optional().nullable(),
});

/** Enregistre les surcharges de la fiche Etsy (vide = valeur générée automatiquement). */
export async function saveEtsyOverridesAction(productId: string, raw: unknown): Promise<Result> {
  try {
    const user = await assertPermission("products:write");
    const input = overridesSchema.parse(raw);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { siteId: true, currency: true } });
    const settings = await etsySettingsFor(product.siteId);
    const account = await findEtsyAccountForSite(product.siteId, settings.accountId);
    if (!account) return { ok: false, error: "Connectez d'abord une boutique Etsy (Marketing social → Connecteurs)." };
    const price = input.priceEuros?.trim() ? Math.round(Number(input.priceEuros.replace(",", ".")) * 100) : null;
    if (price !== null && (!Number.isFinite(price) || price < 20)) return { ok: false, error: "Prix Etsy invalide (0,20 € minimum)." };
    const overrides = {
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      tags: input.tags?.map((t) => t.trim()).filter(Boolean).length ? input.tags.map((t) => t.trim()).filter(Boolean) : null,
      priceCents: price,
    };
    await prisma.etsyListing.upsert({
      where: { productId_accountId: { productId, accountId: account.id } },
      create: { productId, accountId: account.id, currency: product.currency, overrides: overrides as Prisma.InputJsonValue },
      update: { overrides: overrides as Prisma.InputJsonValue },
    });
    await audit({ userId: user.id, action: "etsy.overrides", entity: "product", entityId: productId });
    revalidate(productId);
    return { ok: true, data: undefined };
  } catch (e) { return fail(e); }
}

/** Synchronise l'état des fiches et importe les ventes Etsy. */
export async function syncEtsyNowAction(): Promise<Result<{ synced: number; imported: number }>> {
  try {
    const user = await assertPermission("marketing:write");
    const s = await syncEtsyListings();
    const i = await importEtsySales();
    await audit({ userId: user.id, action: "etsy.sync", entity: "socialAccount", data: { synced: s.synced, imported: i.imported } });
    revalidate();
    revalidatePath("/admin/marketing");
    return { ok: true, data: { synced: s.synced, imported: i.imported } };
  } catch (e) { return fail(e); }
}

/** Univers servis par une boutique Etsy (vide = tous). */
export async function setEtsyAccountSitesAction(accountId: string, siteIds: string[]): Promise<Result> {
  try {
    const user = await assertPermission("marketing:write");
    const valid = await prisma.site.findMany({ where: { id: { in: siteIds } }, select: { id: true } });
    await prisma.socialAccount.update({ where: { id: accountId }, data: { siteIds: valid.map((s) => s.id) } });
    await audit({ userId: user.id, action: "etsy.sites", entity: "socialAccount", entityId: accountId, data: { siteIds: valid.map((s) => s.id) } });
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) { return fail(e); }
}

/** Recherche de catégories Etsy (seller taxonomy) par mots-clés. */
export async function searchEtsyTaxonomyAction(query: string): Promise<Result<TaxonomyNode[]>> {
  try {
    await assertPermission("marketing:write");
    return { ok: true, data: await searchEtsyTaxonomy(query.slice(0, 80)) };
  } catch (e) { return fail(e); }
}
