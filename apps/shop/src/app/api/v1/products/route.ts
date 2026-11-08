import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { attachImageFromUrl } from "@/lib/api/media";
import { apiProductSelect, resolveCategoryAndCollections, serializeProduct } from "@/lib/api/products";
import { createProduct } from "@/lib/products/service";
import { productApiInputSchema } from "@/lib/schemas/product";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/products — liste paginée. */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "products:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage")) || 25));
  const status = url.searchParams.get("status");
  const slug = url.searchParams.get("slug");
  const source = url.searchParams.get("source");
  const where = {
    ...(status && ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(status) ? { status: status as "DRAFT" } : {}),
    ...(slug ? { slug } : {}),
    ...(source ? { source } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage, select: apiProductSelect }),
    prisma.product.count({ where }),
  ]);
  return apiOk(items.map((p) => serializeProduct(p, env.appUrl)), 200, { page, perPage, total });
}

/** POST /api/v1/products — crée un produit en BROUILLON (validation humaine requise). */
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  let body: unknown;
  try { body = await req.json(); } catch { return apiError(400, "Corps JSON invalide"); }
  try {
    const parsed = productApiInputSchema.parse(body);
    const { images, categorySlug, collectionSlugs, ...rest } = parsed;
    const { categoryId, collectionIds } = await resolveCategoryAndCollections({ categorySlug, categoryId: rest.categoryId, collectionSlugs, collectionIds: rest.collectionIds });
    // L'API crée toujours un brouillon : la publication passe par /publish ou par un humain.
    const product = await createProduct({ ...rest, categoryId, collectionIds, status: "DRAFT", scheduledAt: undefined }, { actor: `api:${auth.key.prefix}`, source: "api" });
    const imageErrors: string[] = [];
    for (const img of images) {
      try { await attachImageFromUrl(product.id, img.url, { role: img.role, alt: img.alt }); } catch (e) { imageErrors.push(`${img.url} : ${e instanceof Error ? e.message : "erreur"}`); }
    }
    await audit({ actor: `api:${auth.key.prefix}`, action: "api.product.create", entity: "product", entityId: product.id });
    const full = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: apiProductSelect });
    return apiOk(serializeProduct(full, env.appUrl), 201, imageErrors.length ? { warnings: imageErrors } : {});
  } catch (e) {
    if (e instanceof ZodError) return apiError(422, "Données invalides", e.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    return apiError(400, e instanceof Error ? e.message : "Erreur");
  }
}
