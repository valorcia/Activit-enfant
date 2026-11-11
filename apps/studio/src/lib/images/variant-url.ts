/** Déclinaison d'image servie par /api/assets (vignette, écran, PDF numérique léger). */
export type ImageVariantName = "thumb" | "screen" | "digital";

/** Ajoute ?v=… aux images du studio (/api/assets/…) pour servir une déclinaison légère. */
export function withVariant(src: string | undefined, v: ImageVariantName | undefined): string | undefined {
  if (!src || !v || !src.startsWith("/api/assets/") || /[?&]v=/.test(src)) return src;
  return `${src}${src.includes("?") ? "&" : "?"}v=${v}`;
}
