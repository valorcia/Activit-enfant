/**
 * Prompt maître du copier-coller « en lot » (pur, testable, utilisable côté client) :
 * règles de style communes puis liste numérotée des planches à produire dans ChatGPT.
 */
import type { ColoringComplexity } from "../kits/coloring";

export type SheetGridSize = 1 | 4 | 9;

export function sheetCount(drawings: number, grid: SheetGridSize): number {
  return Math.ceil(drawings / grid);
}

export const GRID_LABELS: Record<SheetGridSize, string> = { 1: "1 dessin par image", 4: "2×2 (4 dessins par image)", 9: "3×3 (9 dessins par image)" };

export function buildSheetMasterPrompt(o: { title: string; ageRange: string; charter: string; complexity: ColoringComplexity; grid: SheetGridSize; drawings: Array<{ numero: number; titre: string; description: string }> }): string {
  const side = o.grid === 9 ? 3 : o.grid === 4 ? 2 : 1;
  const sheets = sheetCount(o.drawings.length, o.grid);
  const layout =
    o.grid === 1
      ? "Chaque image = UN SEUL dessin, centré, format portrait 1024×1536."
      : `Chaque image = une PLANCHE portrait 1024×1536 découpée en grille ${side}×${side} : ${o.grid} cases de même taille, séparées par des gouttières BLANCHES larges et nettes (au moins 40 px), sans trait de séparation ; chaque dessin est centré dans sa case et ne déborde jamais sur la gouttière. Ordre de lecture : de gauche à droite, puis de haut en bas.`;
  const lines: string[] = [
    `Tu vas produire les dessins du cahier de coloriage « ${o.title} » (${o.complexity.label}).`,
    "",
    "RÈGLES DE STYLE (valables pour TOUTES les images) :",
    `- ${o.charter}`,
    `- ${o.complexity.rule}`,
    `- Épaisseur de trait indicative à l'impression : ${o.complexity.strokeMm} ; contours fermés, noir pur sur blanc pur, aucun gris, aucune ombre, aucun remplissage.`,
    "- Aucun texte, aucun numéro, aucune lettre, aucune signature dans les images.",
    `- ${layout}`,
    "",
    `DÉROULEMENT : génère les ${sheets} image(s) à la suite, UNE image par réponse, sans me demander de validation entre deux images. Si tu dois t'arrêter, reprends exactement à l'image suivante quand j'écris « continue ».`,
    "",
    "LISTE DES IMAGES :",
  ];
  for (let s = 0; s < sheets; s++) {
    const group = o.drawings.slice(s * o.grid, (s + 1) * o.grid);
    if (o.grid === 1) lines.push(`Image ${s + 1} — ${group[0].titre} : ${group[0].description}`);
    else {
      lines.push(`Planche ${s + 1} :`);
      group.forEach((d, i) => lines.push(`  case ${i + 1} — ${d.titre} : ${d.description}`));
      if (group.length < o.grid) lines.push(`  cases ${group.length + 1} à ${o.grid} — laisser vides (blanc)`);
    }
  }
  return lines.join("\n");
}
