import { PAGE_FORMATS, type PageFormatKey } from "../schemas/activity";

export function pageSize(format: string, customW?: number | null, customH?: number | null) {
  if (format === "CUSTOM" && customW && customH) return { widthMm: customW, heightMm: customH };
  const f = PAGE_FORMATS[(format as PageFormatKey) in PAGE_FORMATS ? (format as PageFormatKey) : "A4_PORTRAIT"];
  return { widthMm: f.widthMm, heightMm: f.heightMm };
}

/** Conversion mm → px pour l'aperçu écran (96 dpi) */
export const MM_TO_PX = 96 / 25.4;

/** Estimation de la hauteur (mm) occupée par un texte dans une largeur donnée. */
export function estimateTextHeightMm(text: string, widthMm: number, fontPt: number, lineHeight = 1.4) {
  const charWidthMm = fontPt * 0.3527 * 0.54; // largeur moyenne d'un caractère ≈ 0,54 em (Nunito)
  const charsPerLine = Math.max(10, Math.floor(widthMm / charWidthMm));
  const paragraphs = text.split(/\n+/);
  let lines = 0;
  for (const p of paragraphs) lines += Math.max(1, Math.ceil(p.length / charsPerLine));
  return lines * fontPt * 0.3527 * lineHeight;
}
