import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { attachImageBuffer, attachImageFromUrl, removeImagesByRole } from "@/lib/api/media";
import { mediaRoleSchema } from "@/lib/schemas/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonSchema = z.object({ url: z.string().url(), role: mediaRoleSchema.default("GALLERY"), alt: z.string().max(200).optional().nullable(), replace: z.boolean().optional() });
const truthy = (v: unknown) => v === true || v === "1" || v === "true";

/** POST /api/v1/products/:id/images — multipart (file, role, alt, replace) ou JSON { url, role, alt, replace }.
 *  `replace` : supprime d'abord les images existantes du même rôle (re-synchronisation idempotente). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "products:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return apiError(404, "Produit introuvable");
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const file = fd.get("file");
      if (!(file instanceof File)) return apiError(400, "Champ « file » manquant");
      const role = mediaRoleSchema.catch("GALLERY").parse(fd.get("role") ?? "GALLERY");
      if (truthy(fd.get("replace"))) await removeImagesByRole(id, role);
      const image = await attachImageBuffer(id, Buffer.from(await file.arrayBuffer()), file.type || "image/jpeg", { role, alt: (fd.get("alt") as string) || null });
      return apiOk({ id: image.id, url: image.url, role: image.role, position: image.position }, 201);
    }
    const parsed = jsonSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(422, "Données invalides", parsed.error.issues);
    if (parsed.data.replace) await removeImagesByRole(id, parsed.data.role);
    const image = await attachImageFromUrl(id, parsed.data.url, { role: parsed.data.role, alt: parsed.data.alt });
    return apiOk({ id: image.id, url: image.url, role: image.role, position: image.position }, 201);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "Erreur");
  }
}
