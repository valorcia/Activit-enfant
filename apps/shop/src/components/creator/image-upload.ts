"use client";

/**
 * Envoi des photos des créatrices : réduction dans le navigateur (≤ 2 400 px, JPEG) pour
 * rester sous la limite de 4 Mo par requête, quel que soit le téléphone (y compris HEIC sur
 * iPhone, décodé par le navigateur). Le serveur ré-encode et retire les métadonnées.
 */
const LIMIT = 3.8 * 1024 * 1024;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* repli sur <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function resizeToJpeg(file: File, maxSide: number): Promise<Blob> {
  const img = await decode(file).catch(() => null);
  if (!img) {
    if (file.size <= LIMIT && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    throw new Error("Format de photo non reconnu : essayez une photo JPEG ou PNG");
  }
  let side = maxSide;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", attempt === 0 ? 0.86 : 0.78));
    if (blob && blob.size <= LIMIT) { img.close?.(); return blob; }
    side = Math.round(side * 0.75);
  }
  img.close?.();
  throw new Error("Photo trop lourde, même réduite");
}

export interface UploadedCreatorImage { key: string; url?: string; width: number; height: number; size: number }

export async function uploadCreatorImage(file: File, purpose: "photo" | "avatar"): Promise<UploadedCreatorImage> {
  const blob = await resizeToJpeg(file, purpose === "avatar" ? 800 : 2400);
  const fd = new FormData();
  fd.append("file", blob, "photo.jpg");
  fd.append("purpose", purpose);
  const res = await fetch("/api/createur/upload", { method: "POST", body: fd });
  const json = (await res.json().catch(() => null)) as (UploadedCreatorImage & { error?: string }) | null;
  if (!res.ok || !json || json.error) throw new Error(json?.error ?? `Échec de l'envoi (code ${res.status})`);
  return json;
}
