import { NextResponse, type NextRequest } from "next/server";
import { getStorage } from "@/lib/storage";
import { getRequestBrand } from "@/lib/unwritten/brand";
import { ownerCanRead, ownerFromDraft, ownerFromGift } from "@/lib/unwritten/photo-owner";
import { deletePhotos, photoKey } from "@/lib/unwritten/photos";
import { formatPhotoEntry, PHOTO_ID_RE, photoEntries, type Answers } from "@/lib/unwritten/questionnaire/engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function resolveOwner(req: NextRequest) {
  const site = await getRequestBrand();
  if (!site) return null;
  const token = req.nextUrl.searchParams.get("token");
  return token ? ownerFromGift(token) : ownerFromDraft(req.nextUrl.searchParams.get("product") ?? "", site.id);
}

/** Affiche une photo du répondant (vignette par défaut, `?size=full` pour l'original réduit). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!PHOTO_ID_RE.test(id)) return new NextResponse(null, { status: 404 });
  const owner = await resolveOwner(req);
  if (!owner || !ownerCanRead(owner, id)) return new NextResponse(null, { status: 404 });
  const file = await getStorage().get(photoKey(id, req.nextUrl.searchParams.get("size") === "full" ? "full" : "thumb"));
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(file.body), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=600", "x-robots-tag": "noindex" } });
}

/** Retire une photo des réponses du répondant et supprime le fichier. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!PHOTO_ID_RE.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const owner = await resolveOwner(req);
  if (!owner || !owner.editable) return NextResponse.json({ error: "unavailable" }, { status: 403 });
  let found = false;
  const next: Answers = {};
  for (const [k, v] of Object.entries(owner.own)) {
    const entries = photoEntries(v);
    if (!entries.some((e) => e.id === id)) {
      next[k] = v;
      continue;
    }
    found = true;
    const kept = entries.filter((e) => e.id !== id).map(formatPhotoEntry);
    if (kept.length) next[k] = kept;
  }
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await owner.save(next);
  await deletePhotos([id]);
  return NextResponse.json({ ok: true });
}
