/**
 * Accès générique au contenu structuré d'un kit, quel que soit son format
 * (chasse au trésor, idées, guide expert, recettes, expériences).
 */
import type { Coloring, Guide, KitContentFormat, PranksKit, Recipes, Science, TreasureHunt } from "./schemas";

export type KitContent = TreasureHunt | PranksKit | Guide | Recipes | Science | Coloring;

export function formatOf(c: KitContent): KitContentFormat {
  if ("enigmes" in c) return "treasure_hunt";
  if ("idees" in c) return "pranks";
  if ("chapitres" in c) return "guide";
  if ("recettes" in c) return "recipes";
  if ("dessins" in c) return "coloring";
  return "science";
}

/** Éléments principaux (énigmes, idées, chapitres, recettes, expériences). */
export function mainItems(c: KitContent): Array<{ numero: number; title: string; detail: string }> {
  if ("enigmes" in c) return c.enigmes.map((e) => ({ numero: e.numero, title: `Cachette : ${e.cachette}`, detail: e.texte }));
  if ("idees" in c) return c.idees.map((i) => ({ numero: i.numero, title: i.titre, detail: i.resume }));
  if ("chapitres" in c) return c.chapitres.map((ch) => ({ numero: ch.numero, title: ch.titre, detail: ch.resume || ch.contenu.slice(0, 200) }));
  if ("recettes" in c) return c.recettes.map((r) => ({ numero: r.numero, title: r.titre, detail: r.resume }));
  if ("dessins" in c) return c.dessins.map((d) => ({ numero: d.numero, title: d.titre, detail: d.description }));
  return c.experiences.map((e) => ({ numero: e.numero, title: e.titre, detail: e.question || e.explication.slice(0, 200) }));
}

export function mainCount(c: KitContent): number {
  if ("enigmes" in c) return c.enigmes.length;
  if ("idees" in c) return c.idees.length;
  if ("chapitres" in c) return c.chapitres.length;
  if ("recettes" in c) return c.recettes.length;
  if ("dessins" in c) return c.dessins.length;
  return c.experiences.length;
}

/** Personnage principal (null pour les guides et livres de recettes). */
export function heroOf(c: KitContent): string | null {
  if ("enigmes" in c) return c.personnage?.nom || null;
  if ("idees" in c) return c.personnages?.[0]?.nom || null;
  if ("experiences" in c) return c.personnage?.nom || null;
  return null;
}

export function companionOf(c: KitContent): string | null {
  if ("enigmes" in c) return c.personnage?.compagnon || null;
  if ("idees" in c) return c.personnages?.[1]?.nom || null;
  return null;
}

/** Texte d'introduction (lettre du personnage, lettre d'arrivée, introduction du guide…). */
export function introOf(c: KitContent): string {
  if ("enigmes" in c) return c.lettre;
  if ("idees" in c) return c.lettre_arrivee;
  if ("dessins" in c) return c.introduction || `${c.dessins.length} dessins à colorier.`;
  return c.introduction;
}

/** Matériel / ingrédients mis en avant dans la fiche boutique. */
export function materialsOf(c: KitContent): string[] {
  if ("enigmes" in c) return c.guide?.materiel ?? [];
  if ("experiences" in c) return [...new Set(c.experiences.flatMap((e) => e.materiel))].slice(0, 12);
  if ("dessins" in c) return ["Imprimante", "Papier A4 (120 g conseillé pour les feutres)", "Crayons de couleur ou feutres"];
  return [];
}
