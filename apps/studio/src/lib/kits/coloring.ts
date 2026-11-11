/**
 * Cahier de coloriage : complexité selon l'âge, charte « coloriage » (trait noir sur blanc),
 * prompts d'image des dessins. Fonctions pures (testables, utilisables côté client).
 */
import type { Coloring } from "./schemas";

export type ColoringLevel = "simple" | "moyen" | "detaille";

export interface ColoringComplexity {
  level: ColoringLevel;
  label: string;
  /** Consigne de dessin insérée dans chaque prompt */
  rule: string;
  /** Épaisseur de trait indicative à l'impression A4 */
  strokeMm: string;
}

const COMPLEXITY: Record<ColoringLevel, ColoringComplexity> = {
  simple: { level: "simple", label: "Très simple (3–5 ans)", strokeMm: "4 à 5 mm", rule: "Dessin très simple pour les 3–5 ans : un seul grand sujet centré, 5 à 12 grandes zones à colorier, contours très épais et réguliers, aucun petit détail, décor absent ou réduit à 1 ou 2 éléments (soleil, herbe)." },
  moyen: { level: "moyen", label: "Simple à moyen (6–8 ans)", strokeMm: "2 à 3 mm", rule: "Dessin de difficulté moyenne pour les 6–8 ans : sujet principal et petit décor, 15 à 35 zones, contours épais à moyens, détails lisibles sans zones minuscules." },
  detaille: { level: "detaille", label: "Détaillé (8–10 ans)", strokeMm: "1 à 1,5 mm", rule: "Dessin détaillé pour les 8–10 ans : scène complète avec décor, 30 à 70 zones, motifs (écailles, feuillages, rayures) dessinés au trait, contours fins mais nets." },
};

/** Complexité par défaut selon la tranche d'âge du livre (3–5 → simple, 6–8 → moyen, 8–10 → détaillé). */
export function coloringComplexity(ageRange: string | null | undefined, override?: ColoringLevel | null): ColoringComplexity {
  if (override) return COMPLEXITY[override];
  const m = /^(\d+)-(\d+)$/.exec(ageRange ?? "");
  const min = m ? Number(m[1]) : 5;
  const max = m ? Number(m[2]) : 8;
  if (max <= 5 || (min <= 4 && max <= 6)) return COMPLEXITY.simple;
  if (min >= 8) return COMPLEXITY.detaille;
  return COMPLEXITY.moyen;
}

export const COLORING_LEVELS = COMPLEXITY;

/** Clé de la charte « coloriage » dans StudioSettings.illustrationCharters (éditable dans Paramètres → Univers). */
export const COLORING_CHARTER_KEY = "coloriage";

/** Charte par défaut des dessins à colorier (la couverture reste en couleur, avec la charte de l'univers). */
export const DEFAULT_COLORING_CHARTER = [
  "Page de coloriage pour enfants : dessin au trait NOIR PUR sur fond BLANC PUR, comme une page de cahier de coloriage imprimé.",
  "Contours noirs nets, continus et FERMÉS (chaque zone peut être remplie sans déborder), épaisseur de trait régulière.",
  "Aucun gris, aucune ombre, aucun dégradé, aucune trame, aucun remplissage noir ou coloré : uniquement des lignes noires sur blanc.",
  "Aucun texte, aucune lettre, aucun chiffre, aucun cadre ni bordure de page, aucune signature.",
  "Le dessin occupe la page en portrait avec une marge blanche d'environ 8 % sur chaque bord ; style mignon, expressif et bienveillant.",
].join(" ");

export function coloringCharterFor(overrides: Partial<Record<string, string>> | undefined): string {
  return overrides?.[COLORING_CHARTER_KEY]?.trim() || DEFAULT_COLORING_CHARTER;
}

/** Emplacements d'illustration du cahier. */
export const COLORING_SLOTS = {
  drawing: (n: number) => `dessin-${n}`,
  sample: "exemple-colore",
} as const;

export function isDrawingSlot(slot: string | null | undefined): boolean {
  return /^dessin-\d+$/.test(slot ?? "");
}

export function drawingNumber(slot: string | null | undefined): number | null {
  const m = /^dessin-(\d+)$/.exec(slot ?? "");
  return m ? Number(m[1]) : null;
}

/** Prompt d'un dessin : sujet + complexité (la charte « coloriage » est ajoutée par le générateur). */
export function drawingPrompt(d: Coloring["dessins"][number], ageRange: string): string {
  const cx = coloringComplexity(ageRange, d.niveau_detail === "moyen" ? null : d.niveau_detail);
  return `${d.titre} : ${d.description}\n${cx.rule} Épaisseur de trait indicative à l'impression : ${cx.strokeMm}.`;
}

/** Prompt de la page d'exemple colorée (version en couleur du premier dessin). */
export function samplePrompt(d: Coloring["dessins"][number] | undefined): string {
  return d
    ? `Version COLORIÉE du dessin « ${d.titre} » (${d.description}) : mêmes contours noirs, zones remplies de couleurs vives et gaies comme si un enfant soigneux l'avait colorié aux feutres, fond blanc. Aucun texte.`
    : "Exemple de page de coloriage joliment coloriée aux feutres, couleurs vives, fond blanc. Aucun texte.";
}
