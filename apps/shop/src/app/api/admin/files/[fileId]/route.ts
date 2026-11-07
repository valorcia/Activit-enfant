import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getStorage, safeFileName } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Téléchargement d'un fichier payant par un administrateur (URL signée courte). */
export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const user = await getAdminUser();
  if (!user || !roleCan(user.role, "products:read")) return new NextResponse("Non autorisé", { status: 403 });
  const { fileId } = await ctx.params;
  const file = await prisma.productFile.findUnique({ where: { id: fileId } });
  if (!file) return new NextResponse("Introuvable", { status: 404 });
  const url = await getStorage().signedUrl(file.storageKey, { expiresInSeconds: 120, fileName: safeFileName(file.name) });
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
}
