import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { getStorage } from "@/lib/storage";
import { parseVideoAlt, presignVideoUpload, registerProductVideo, storeProductVideo, VIDEO_MIME_EXT } from "@/lib/api/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const formatSchema = z.enum(["story", "square", "landscape"]);
const jsonSchema = z.discriminatedUnion("action", [
  // Étape 1 (stockage S3 / Vercel) : obtenir une URL de téléversement directe
  z.object({ action: z.literal("presign"), contentType: z.string().default("video/mp4") }),
  // Étape 2 : enregistrer la vidéo déposée sur le stockage
  z.object({ action: z.literal("register"), key: z.string().min(1), format: formatSchema.default("story"), title: z.string().max(150).optional() }),
]);

async function findProduct(idOrSlug: string) {
  return prisma.product.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, select: { id: true } });
}

/** GET /api/v1/products/:id/videos — vidéos publicitaires du produit. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const product = await findProduct((await ctx.params).id);
  if (!product) return apiError(404, "Produit introuvable");
  const videos = await prisma.productImage.findMany({ where: { productId: product.id, role: "VIDEO" }, orderBy: { position: "asc" } });
  return apiOk(videos.map((v) => ({ id: v.id, url: v.url, ...parseVideoAlt(v.alt), width: v.width, height: v.height, createdAt: v.createdAt })));
}

/**
 * POST /api/v1/products/:id/videos
 *  - multipart/form-data : file (MP4/WebM/MOV ≤ 200 Mo), format (story|square|landscape), title
 *    (limité à 4,5 Mo sur Vercel : au-delà, utiliser le téléversement direct ci-dessous)
 *  - JSON { action: "presign", contentType } → { key, uploadUrl } (PUT direct sur le stockage S3)
 *  - JSON { action: "register", key, format, title } → enregistre la vidéo déposée
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const product = await findProduct((await ctx.params).id);
  if (!product) return apiError(404, "Produit introuvable");
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const file = fd.get("file");
      if (!(file instanceof File)) return apiError(400, "Champ « file » manquant");
      const format = formatSchema.catch("story").parse(fd.get("format") ?? "story");
      const video = await storeProductVideo(product.id, Buffer.from(await file.arrayBuffer()), file.type || "video/mp4", format, (fd.get("title") as string) || null);
      return apiOk({ id: video.id, url: video.url, format }, 201);
    }
    const parsed = jsonSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(422, "Données invalides", parsed.error.issues);
    if (parsed.data.action === "presign") {
      const presigned = await presignVideoUpload(product.id, parsed.data.contentType);
      if (!presigned) return apiError(409, "Téléversement direct indisponible (stockage local) : envoyez la vidéo en multipart");
      return apiOk(presigned);
    }
    const key = parsed.data.key;
    if (!key.startsWith(`public/videos/${product.id}/`) || !Object.values(VIDEO_MIME_EXT).some((ext) => key.endsWith(`.${ext}`))) return apiError(400, "Clé de stockage invalide");
    if (!(await getStorage().exists(key))) return apiError(400, "Fichier introuvable sur le stockage : terminez le téléversement avant l'enregistrement");
    const video = await registerProductVideo(product.id, key, parsed.data.format, parsed.data.title);
    return apiOk({ id: video.id, url: video.url, format: parsed.data.format }, 201);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "Erreur");
  }
}
