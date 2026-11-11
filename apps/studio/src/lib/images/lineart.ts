import sharp from "sharp";

/**
 * Dessins à colorier : contrôle « noir et blanc » et conversion par seuillage (sharp, gratuit,
 * aucune regénération). Une image qui contient du gris, des ombres ou un peu de couleur est
 * convertie en trait noir pur sur blanc pur ; seuls les gros aplats noirs (zones impossibles à
 * colorier) restent signalés.
 */
export interface LineArtStats {
  /** Pixels blancs (fond) */
  white: number;
  /** Pixels noirs (trait) */
  black: number;
  /** Pixels gris (ni blancs ni noirs) */
  gray: number;
  /** Pixels colorés (saturation visible) */
  color: number;
}

const WORK = 512;

export async function lineArtStats(data: Buffer): Promise<LineArtStats> {
  const { data: px, info } = await sharp(data).flatten({ background: "#ffffff" }).resize({ width: WORK, height: WORK, fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let white = 0, black = 0, gray = 0, color = 0;
  const n = info.width * info.height;
  for (let i = 0; i < px.length; i += info.channels) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min > 40) color++;
    else if (min >= 235) white++;
    else if (max <= 70) black++;
    else gray++;
  }
  return { white: white / n, black: black / n, gray: gray / n, color: color / n };
}

/** Vrai dessin au trait : presque uniquement du blanc et du noir. */
export function isLineArt(s: LineArtStats): boolean {
  return s.color < 0.005 && s.gray < 0.03 && s.black > 0.003;
}

/** Problèmes non corrigeables par seuillage (à regarder dans l'aperçu). */
export function lineArtWarnings(s: LineArtStats): string[] {
  const w: string[] = [];
  if (s.black > 0.35) w.push("Grands aplats noirs : zones impossibles à colorier.");
  if (s.black + s.gray < 0.004) w.push("Dessin presque vide.");
  return w;
}

/** Conversion en noir et blanc pur (seuil de luminance, 0–255). */
export async function toLineArt(data: Buffer, threshold = 175): Promise<Buffer> {
  return sharp(data).flatten({ background: "#ffffff" }).grayscale().threshold(threshold).png({ compressionLevel: 9, palette: true, colours: 2 }).toBuffer();
}

/** Contrôle puis conversion si nécessaire ; renvoie l'image à conserver. */
export async function ensureLineArt(data: Buffer): Promise<{ data: Buffer; converted: boolean; stats: LineArtStats; warnings: string[] }> {
  const stats = await lineArtStats(data);
  const warnings = lineArtWarnings(stats);
  if (isLineArt(stats)) return { data, converted: false, stats, warnings };
  const out = await toLineArt(data);
  return { data: out, converted: true, stats: await lineArtStats(out), warnings };
}
