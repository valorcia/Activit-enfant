import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { apiProductSelect, productToInput, resolveCategoryAndCollections, serializeProduct } from "@/lib/api/products";
import { updateProduct } from "@/lib/products/service";
import { productApiInputSchema } from "@/lib/schemas/product";
import { attachImageFromUrl } from "@/lib/api/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await authenticateApiKey(req, "products:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const p = await prisma.product.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: apiProductSelect });
  if (!p) return apiError(404, "Produit introuvable");
  return apiOk(serializeProduct(p, env.appUrl));
}

/** PATCH — mise à jour partielle : fusion avec l'existant puis validation complète. */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const existing = await productToInput(id);
  if (!existing) return apiError(404, "Produit introuvable");
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return apiError(400, "Corps JSON invalide"); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return apiError(400, "Objet JSON attendu");
  try {
    // Le statut ne se modifie que via /publish (ou par un humain), sauf retour en brouillon
    const { status: requestedStatus, images, categorySlug, collectionSlugs, ...patch } = body as Record<string, unknown> & { images?: unknown; categorySlug?: string; collectionSlugs?: string[] };
    const merged = { ...existing, ...patch };
    if (requestedStatus === "DRAFT" || requestedStatus === "ARCHIVED") merged.status = requestedStatus;
    const parsed = productApiInputSchema.parse({ ...merged, images: images ?? [], categorySlug, collectionSlugs });
    const { images: imgs, categorySlug: cs, collectionSlugs: cols, ...rest } = parsed;
    const resolved = await resolveCategoryAndCollections({ categorySlug: cs, categoryId: rest.categoryId, collectionSlugs: cols, collectionIds: cols?.length ? [] : rest.collectionIds });
    const product = await updateProduct(id, { ...rest, categoryId: resolved.categoryId, collectionIds: resolved.collectionIds }, { actor: `api:${auth.key.prefix}`, source: "api" });
    const warnings: string[] = [];
    for (const img of imgs) {
      try { await attachImageFromUrl(product.id, img.url, { role: img.role, alt: img.alt }); } catch (e) { warnings.push(`${img.url} : ${e instanceof Error ? e.message : "erreur"}`); }
    }
    const full = await prisma.product.findUniqueOrThrow({ where: { id }, select: apiProductSelect });
    return apiOk(serializeProduct(full, env.appUrl), 200, warnings.length ? { warnings } : {});
  } catch (e) {
    if (e instanceof ZodError) return apiError(422, "Données invalides", e.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    return apiError(400, e instanceof Error ? e.message : "Erreur");
  }
}
