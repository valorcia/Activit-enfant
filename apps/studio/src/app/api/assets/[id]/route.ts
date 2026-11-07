import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return new NextResponse("Not found", { status: 404 });
  const storage = getStorage();
  const direct = storage.publicUrl(asset.key);
  if (direct) return NextResponse.redirect(direct);
  try {
    const data = await storage.get(asset.key);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(data.length),
        "Cache-Control": "private, max-age=3600",
        ...(asset.mime === "application/pdf" ? { "Content-Disposition": `inline; filename="${asset.key.split("/").pop()}"` } : {}),
      },
    });
  } catch {
    return new NextResponse("Fichier introuvable dans le stockage", { status: 404 });
  }
}
