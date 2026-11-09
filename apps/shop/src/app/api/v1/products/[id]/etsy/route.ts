import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { audit } from "@/lib/audit";
import { EtsyError, EtsyNotConnectedError, etsySettingsFor, publishProductToEtsy } from "@/lib/channels/etsy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ state: z.enum(["draft", "active"]).optional(), accountId: z.string().max(64).optional() });

/**
 * POST /api/v1/products/:id/etsy — crée ou met à jour la fiche Etsy du produit (idempotent).
 * Corps : { state?: "draft" | "active", accountId?: string }
 * 200 { data: { listingId, url, state, warnings } }
 * 409 { error: "etsy_not_connected" } : aucune boutique Etsy rattachée à l'univers du produit
 * 409 { error: "etsy_disabled" } : publication Etsy désactivée dans les réglages de l'univers
 * 422 { error, code } : produit incomplet (PDF > 20 Mo, plus de 5 fichiers, catégorie Etsy manquante…)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const product = await prisma.product.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, siteId: true } });
  if (!product) return apiError(404, "Produit introuvable");
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError(422, "Données invalides", parsed.error.issues);
  const settings = await etsySettingsFor(product.siteId);
  if (!settings.enabled) return Response.json({ error: "etsy_disabled", message: "Publication Etsy désactivée pour cet univers (Marketing social → Etsy)." }, { status: 409 });
  try {
    const r = await publishProductToEtsy(product.id, { state: parsed.data.state ?? settings.defaultState, accountId: parsed.data.accountId, actor: `api:${auth.key.prefix}` });
    await audit({ actor: `api:${auth.key.prefix}`, action: r.created ? "etsy.create" : "etsy.update", entity: "product", entityId: product.id, data: { listingId: r.listing.etsyListingId, state: r.listing.state } });
    return apiOk({ listingId: r.listing.etsyListingId, url: r.listing.url, state: r.listing.state, warnings: r.warnings, created: r.created });
  } catch (e) {
    if (e instanceof EtsyNotConnectedError) return Response.json({ error: "etsy_not_connected", message: e.message }, { status: 409 });
    if (e instanceof EtsyError) {
      const status = e.status && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403 ? e.status : 502;
      return Response.json({ error: e.message, code: e.code ?? (e.reconnect ? "etsy_reconnect" : "etsy_error") }, { status: e.reconnect ? 409 : status });
    }
    return apiError(500, e instanceof Error ? e.message : "Erreur");
  }
}
