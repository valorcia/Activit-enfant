import { NextResponse, type NextRequest } from "next/server";
import { getRequestBrand } from "@/lib/unwritten/brand";
import { ownerFromDraft, ownerFromGift, visiblePhotoQuestion } from "@/lib/unwritten/photo-owner";
import { PhotoError, PHOTO_MAX_BYTES, photoCapacity, storePhoto, deletePhotos } from "@/lib/unwritten/photos";
import { photoEntries } from "@/lib/unwritten/questionnaire/engine";
import { rateLimited } from "@/lib/unwritten/rate-limit";
import { clientIp } from "@/lib/unwritten/session";

export const runtime = "nodejs";

/**
 * Téléversement d'une photo pour une question « photos » du questionnaire UNWRITTEN.
 * Corps multipart : file, question, et soit product (brouillon de ce navigateur), soit token (lien cadeau).
 * Réponse : { id, width, height, lowRes } ; la photo est ajoutée aux réponses du répondant.
 */
export async function POST(req: NextRequest) {
  const site = await getRequestBrand();
  if (!site) return NextResponse.json({ error: "unavailable" }, { status: 404 });
  if (rateLimited("photoUploadIp", await clientIp())) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  const file = form.get("file");
  const questionId = String(form.get("question") ?? "");
  const token = String(form.get("token") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "not_image" }, { status: 400 });
  if (file.size > PHOTO_MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const owner = token ? await ownerFromGift(token) : await ownerFromDraft(String(form.get("product") ?? ""), site.id);
  if (!owner || !owner.editable) return NextResponse.json({ error: "unavailable" }, { status: 403 });
  const q = visiblePhotoQuestion(owner, questionId);
  if (!q) return NextResponse.json({ error: "unavailable" }, { status: 400 });
  const current = photoEntries(owner.own[q.id]);
  if (current.length >= photoCapacity(q)) return NextResponse.json({ error: "too_many" }, { status: 409 });

  try {
    const photo = await storePhoto(Buffer.from(await file.arrayBuffer()));
    try {
      await owner.save({ ...owner.own, [q.id]: [...current.map((e) => (e.caption ? `${e.id}::${e.caption}` : e.id)), photo.id] });
    } catch (e) {
      await deletePhotos([photo.id]);
      throw e;
    }
    return NextResponse.json(photo, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof PhotoError) return NextResponse.json({ error: e.code }, { status: e.code === "too_large" ? 413 : 400 });
    console.error("[unwritten] téléversement photo", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
