import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { photoResponse } from "@/lib/creators/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Photo d'une proposition pour la modération (équipe uniquement). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; index: string }> }) {
  const user = await getAdminUser();
  if (!user) return new Response("Authentification requise", { status: 401 });
  if (!roleCan(user.role, "creators:read")) return new Response("Permission insuffisante", { status: 403 });
  const { id, index } = await ctx.params;
  const sub = await prisma.creatorSubmission.findUnique({ where: { id }, select: { photos: true } });
  if (!sub) return new Response("Introuvable", { status: 404 });
  return photoResponse(sub, Number(index));
}
