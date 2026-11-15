import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { creatorFromSession } from "@/lib/creators/auth";
import { CREATOR_SESSION_COOKIE } from "@/lib/creators/tokens";
import { CREATOR_IMAGE_TYPES, CREATOR_UPLOAD_MAX_BYTES, storeCreatorImage } from "@/lib/creators/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Envoi d'une photo par une créatrice connectée (multipart « file », « purpose » = photo | avatar).
 * Les photos sont réduites côté navigateur avant l'envoi, puis ré-encodées ici.
 */
export async function POST(req: Request) {
  const creator = await creatorFromSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creator) return NextResponse.json({ error: "Session expirée : reconnectez-vous" }, { status: 401 });
  if (creator.status !== "ACTIVE") return NextResponse.json({ error: "Compte non actif : acceptez d'abord le contrat" }, { status: 403 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Envoi invalide" }, { status: 400 }); }
  const file = form.get("file");
  const purpose = form.get("purpose") === "avatar" ? "avatar" : "photo";
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (file.size > CREATOR_UPLOAD_MAX_BYTES) return NextResponse.json({ error: "Photo trop lourde (4 Mo maximum)" }, { status: 413 });
  if (file.type && !CREATOR_IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Format non accepté : envoyez une photo JPEG, PNG ou WebP" }, { status: 415 });
  try {
    const stored = await storeCreatorImage(creator.id, Buffer.from(await file.arrayBuffer()), purpose);
    return NextResponse.json(stored);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/unsupported image format|Input buffer|corrupt/i.test(msg)) return NextResponse.json({ error: "Image illisible : essayez une autre photo (JPEG ou PNG)" }, { status: 415 });
    console.error("[creator-upload]", msg);
    return NextResponse.json({ error: msg.includes("Stockage") ? msg : "Erreur lors de l'enregistrement de la photo" }, { status: 500 });
  }
}
