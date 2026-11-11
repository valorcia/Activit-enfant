import sharp from "sharp";

/**
 * Déclinaisons d'une image servies par /api/assets/[id]?v=… (calculées une fois puis mises
 * en cache dans le stockage) :
 * - thumb : vignette 320 px (WebP) — miniatures de l'aperçu, planches déposées ;
 * - screen : 1400 px (WebP) — page affichée dans l'aperçu ;
 * - digital : 1600 px — PDF « numérique léger » (JPEG 82 %, ou PNG 2 couleurs pour un dessin au trait).
 * Le PDF « qualité d'impression » utilise l'original.
 */
export const IMAGE_VARIANTS = ["thumb", "screen", "digital"] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

export function isImageVariant(v: string | null | undefined): v is ImageVariant {
  return Boolean(v && (IMAGE_VARIANTS as readonly string[]).includes(v));
}

export function variantKey(key: string, v: ImageVariant) {
  return `variants/${v}/${key}`;
}

export async function makeVariant(data: Buffer, v: ImageVariant): Promise<{ data: Buffer; mime: string }> {
  const width = v === "thumb" ? 320 : v === "screen" ? 1400 : 1600;
  const img = sharp(data).flatten({ background: "#ffffff" }).resize({ width, height: width * 2, fit: "inside", withoutEnlargement: true });
  if (v !== "digital") return { data: await img.webp({ quality: v === "thumb" ? 70 : 82 }).toBuffer(), mime: "image/webp" };
  // Dessin au trait (palette réduite) : PNG 2 couleurs, net et très léger ; sinon JPEG
  const stats = await sharp(data).stats().catch(() => null);
  const bw = stats ? stats.channels.slice(0, 3).every((c) => c.min <= 10 && c.max >= 245) && stats.isOpaque !== false && (await isTwoTone(data)) : false;
  if (bw) return { data: await img.png({ palette: true, colours: 2, compressionLevel: 9 }).toBuffer(), mime: "image/png" };
  return { data: await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer(), mime: "image/jpeg" };
}

async function isTwoTone(data: Buffer): Promise<boolean> {
  const { data: px } = await sharp(data).resize({ width: 128, height: 128, fit: "inside" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let mid = 0;
  for (const p of px) if (p > 40 && p < 215) mid++;
  return mid / px.length < 0.04;
}
