/**
 * Cadrage des illustrations — fonctions pures (sans base ni sharp), utilisées par la
 * mise en page, le rendu (aperçu = PDF), les contrôles qualité et l'éditeur de cadrage.
 *
 * Principe : on génère au bon format (ratio de l'emplacement), puis on ajuste le
 * cadrage (point focal, zoom, remplir/ajuster) sans jamais relancer l'IA.
 */

export type TargetRatio = "portrait" | "landscape" | "square";
export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";
export type Fit = "cover" | "contain";

/** Taille demandée au fournisseur pour un ratio cible (formats acceptés par GPT Image). */
export const RATIO_SIZES: Record<TargetRatio, ImageSize> = {
  portrait: "1024x1536",
  landscape: "1536x1024",
  square: "1024x1024",
};

export const RATIO_VALUES: Record<TargetRatio, number> = { portrait: 2 / 3, landscape: 3 / 2, square: 1 };

export const RATIO_LABELS: Record<TargetRatio, string> = {
  portrait: "portrait (2:3)",
  landscape: "paysage (3:2)",
  square: "carré (1:1)",
};

export function sizeForRatio(ratio: TargetRatio): ImageSize {
  return RATIO_SIZES[ratio];
}

/** Ratio cible le plus proche d'un cadre (largeur / hauteur). */
export function nearestRatio(frameW: number, frameH: number): TargetRatio {
  const r = frameW / frameH;
  let best: TargetRatio = "square";
  let bestDiff = Infinity;
  for (const k of Object.keys(RATIO_VALUES) as TargetRatio[]) {
    const d = Math.abs(Math.log(r / RATIO_VALUES[k]));
    if (d < bestDiff) {
      best = k;
      bestDiff = d;
    }
  }
  return best;
}

/**
 * Emplacement d'illustration → format cible. Les cadres des gabarits de pages ont été
 * dimensionnés pour rester à moins de 25 % de ces formats.
 */
export function ratioForSlot(slot: string | null | undefined, kind?: string | null): TargetRatio {
  if (kind === "COVER") return "square";
  if (kind === "FINAL" || kind === "STEP" || kind === "MATERIAL") return "square";
  const s = slot ?? "";
  if (s === "visuel-story") return "portrait";
  if (s === "visuel-heros") return "square";
  if (s.startsWith("planche")) return "landscape";
  if (/^enigme-image-|^carte$|^diplome$|^certificat$|^invitation$/.test(s)) return "portrait";
  if (/^lettre|^idee-|^chapitre-|^recette-|^experience-|^guide-probleme/.test(s)) return "landscape";
  return "square";
}

/**
 * Consignes de composition ajoutées au prompt selon l'emplacement : format, sujet dans la
 * zone utile, marges de sécurité, zones laissées libres quand le gabarit pose du texte.
 */
export function compositionHints(slot: string | null | undefined, kind?: string | null): string {
  const ratio = ratioForSlot(slot, kind);
  const s = slot ?? "";
  const lines = [
    `Format ${RATIO_LABELS[ratio]}, image pleine, sans bordure ni cadre.`,
    "Composition : sujet principal centré dans la zone utile, entièrement visible ; garder une marge de sécurité d'environ 10 % sur chaque bord, sans visage, main ou objet important coupé.",
  ];
  if (s === "visuel-story") lines.push("Tiers supérieur et tiers inférieur en fond clair et simple (zones réservées au texte de la publicité) ; le sujet occupe le tiers central.");
  else if (s.startsWith("planche")) lines.push("Planche de référence : poses séparées, alignées, sur fond uni clair, sans chevauchement.");
  else if (s === "carte") lines.push("Carte vue de dessus remplissant toute l'image ; le X et le cadre vide sous le X bien à l'intérieur de la zone utile, loin des bords (la carte sera découpée en morceaux).");
  else if (s === "diplome" || s === "certificat") lines.push("Personnage dans la moitié inférieure et sur un côté ; le haut de l'image reste aéré (l'illustration est posée à côté du texte du diplôme).");
  else if (s === "invitation") lines.push("Sujet centré verticalement ; fond doux et peu chargé en haut et en bas.");
  else if (s.startsWith("lettre")) lines.push("Scène en bandeau horizontal : action au centre, ciel ou mur dégagé en haut ; le texte de la lettre est placé sous l'image.");
  else if (s.startsWith("enigme-image")) lines.push("Cadrage serré et très lisible pour un enfant : la cachette et l'objet caché au centre, le coin supérieur gauche reste simple (une pastille numérotée y est posée).");
  else if (kind === "COVER") lines.push("Illustration de couverture : personnages et action au centre, fond lisible ; aucun titre dans l'image (le titre est ajouté par la mise en page).");
  lines.push("Aucun texte, aucune lettre, aucun chiffre, aucun logo dans l'image.");
  return lines.join("\n");
}

/** Écart de format entre une image et son cadre (0 = identique, 0.25 = 25 %). */
export function ratioMismatch(imgW: number, imgH: number, frameW: number, frameH: number): number {
  if (!imgW || !imgH || !frameW || !frameH) return 0;
  const a = imgW / imgH;
  const b = frameW / frameH;
  return Math.max(a, b) / Math.min(a, b) - 1;
}

/** Au-delà de cet écart, l'image passe automatiquement en « ajuster » (aucune coupe). */
export const AUTO_CONTAIN_MISMATCH = 0.25;

/** Ajustement effectif : choix manuel, sinon automatique selon l'écart de format. */
export function effectiveFit(o: { fit?: string | null; imgW?: number | null; imgH?: number | null; frameW: number; frameH: number }): Fit {
  if (o.fit === "cover" || o.fit === "contain") return o.fit;
  if (o.imgW && o.imgH && ratioMismatch(o.imgW, o.imgH, o.frameW, o.frameH) > AUTO_CONTAIN_MISMATCH) return "contain";
  return "cover";
}

/**
 * Résolution effective à l'impression (points par pouce) d'une image dans un cadre.
 * cover : l'image est agrandie pour remplir le cadre ; contain : elle y tient entière.
 */
export function effectiveDpi(o: { imgW: number; imgH: number; frameWmm: number; frameHmm: number; fit: Fit; zoom?: number }): number {
  const fw = o.frameWmm / 25.4;
  const fh = o.frameHmm / 25.4;
  if (!o.imgW || !o.imgH || fw <= 0 || fh <= 0) return 0;
  const zoom = Math.max(1, o.zoom ?? 1);
  const dpi = o.fit === "cover" ? Math.min(o.imgW / fw, o.imgH / fh) : Math.max(o.imgW / fw, o.imgH / fh);
  return Math.round(dpi / (o.fit === "cover" ? zoom : 1));
}

export const DPI_WARN = 150;
export const DPI_BLOCK = 100;

export function clamp01(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));
}
export function clampZoom(n: number) {
  return Math.min(3, Math.max(1, Number.isFinite(n) ? n : 1));
}

export interface Framing {
  focalX?: number;
  focalY?: number;
  zoom?: number;
  fit: Fit;
}

/** Styles CSS de l'image dans son cadre (identiques en aperçu et en PDF). */
export function framingStyle(f: Framing): { objectFit: Fit; objectPosition: string; transform?: string; transformOrigin?: string } {
  const fx = clamp01(f.focalX ?? 0.5);
  const fy = clamp01(f.focalY ?? 0.5);
  const zoom = clampZoom(f.zoom ?? 1);
  const pos = `${round(fx * 100)}% ${round(fy * 100)}%`;
  return {
    objectFit: f.fit,
    objectPosition: f.fit === "cover" ? pos : "50% 50%",
    ...(zoom > 1.001 ? { transform: `scale(${round(zoom)})`, transformOrigin: pos } : {}),
  };
}

/**
 * Point focal → centre du recadrage d'une image remplissant un cadre (fractions 0–1 de
 * l'image). Utile pour vérifier qu'un point d'intérêt reste visible.
 */
export function visibleWindow(o: { imgW: number; imgH: number; frameW: number; frameH: number; focalX: number; focalY: number; zoom?: number }) {
  const scale = Math.max(o.frameW / o.imgW, o.frameH / o.imgH) * Math.max(1, o.zoom ?? 1);
  const vw = Math.min(1, o.frameW / scale / o.imgW);
  const vh = Math.min(1, o.frameH / scale / o.imgH);
  const x0 = clamp01(o.focalX) * (1 - vw);
  const y0 = clamp01(o.focalY) * (1 - vh);
  return { x0, y0, x1: x0 + vw, y1: y0 + vh, vw, vh };
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
