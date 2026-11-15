import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { creatorFromSession } from "@/lib/creators/auth";
import { CREATOR_SESSION_COOKIE } from "@/lib/creators/tokens";
import { photoResponse } from "@/lib/creators/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Photo d'une proposition, servie uniquement à la créatrice qui l'a envoyée. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; index: string }> }) {
  const creator = await creatorFromSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creator) return new Response("Authentification requise", { status: 401 });
  const { id, index } = await ctx.params;
  const sub = await prisma.creatorSubmission.findFirst({ where: { id, creatorId: creator.id }, select: { photos: true } });
  if (!sub) return new Response("Introuvable", { status: 404 });
  return photoResponse(sub, Number(index));
}
