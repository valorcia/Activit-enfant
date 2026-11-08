/**
 * Contrôles qualité automatiques du contenu d'un kit (purs, testables) :
 * nombre d'éléments attendu, champs obligatoires, longueurs, mentions interdites.
 * Les corrections sûres sont appliquées automatiquement ; les problèmes bloquants
 * font échouer l'étape avec une explication lisible.
 */
import type { KitContent } from "../kits/generate";
import type { PranksKit, TreasureHunt } from "../kits/schemas";

export interface QualityIssue {
  level: "error" | "warning";
  message: string;
}

export interface QualityReport {
  ok: boolean;
  content: KitContent;
  fixes: string[];
  issues: QualityIssue[];
}

/** Marques et personnages sous licence : interdits dans les contenus et les fiches. */
const FORBIDDEN_BRANDS: Array<[RegExp, string]> = [
  [/elf on the shelf/i, "Elf on the Shelf"],
  [/\bdisney\b/i, "Disney"],
  [/\bpixar\b/i, "Pixar"],
  [/\bmarvel\b/i, "Marvel"],
  [/pok[ée]mon/i, "Pokémon"],
  [/pat'? ?patrouille|paw patrol/i, "Pat'Patrouille"],
  [/peppa pig/i, "Peppa Pig"],
  [/\blego\b/i, "Lego"],
  [/playmobil/i, "Playmobil"],
  [/\bbarbie\b/i, "Barbie"],
  [/harry potter/i, "Harry Potter"],
  [/\bnasa\b/i, "NASA"],
  [/star wars/i, "Star Wars"],
  [/minecraft/i, "Minecraft"],
  [/fortnite/i, "Fortnite"],
  [/reine des neiges/i, "La Reine des neiges"],
  [/spider-?man/i, "Spider-Man"],
];

/** Faux avis, fausses notes, faux chiffres de vente. */
const FAKE_CLAIMS: Array<[RegExp, string]> = [
  [/\b\d[\d\s.]*\+?\s*(familles|parents|clients|enfants)\s+(ravi|satisfait|conquis|comblé|l'ont)/i, "chiffre de clients satisfaits"],
  [/note\s+(moyenne\s+)?de\s+\d[,.]\d/i, "note moyenne"],
  [/\b\d[,.]\d\s*\/\s*5\b/, "note sur 5"],
  [/★★★★/, "étoiles d'avis"],
  [/\b(n°\s?1|numéro un)\s+(des ventes|en france)/i, "classement des ventes"],
  [/\bdéjà\s+\d[\d\s.]*\s+(ventes|exemplaires|téléchargements)/i, "chiffre de ventes"],
];

const LIMITS = { enigme: 420, idee: 400, seoTitle: 70, seoDescription: 160, shortDescription: 400 };

function allText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(allText).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(allText).join("\n");
  return "";
}

export function checkKitContent(input: KitContent, opts: { expectedCount: number; companion?: string }): QualityReport {
  const fixes: string[] = [];
  const issues: QualityIssue[] = [];
  const content = structuredClone(input) as KitContent;
  const expected = Math.max(1, opts.expectedCount);

  if ("enigmes" in content) checkHunt(content, expected, opts.companion, fixes, issues);
  else checkPranks(content as PranksKit, expected, fixes, issues);

  // Fiche boutique : longueurs SEO
  const b = content.boutique;
  if (b) {
    if (b.seoTitle && b.seoTitle.length > LIMITS.seoTitle) { b.seoTitle = b.seoTitle.slice(0, LIMITS.seoTitle).trim(); fixes.push("Titre SEO raccourci à 70 caractères"); }
    if (b.seoDescription && b.seoDescription.length > LIMITS.seoDescription) { b.seoDescription = b.seoDescription.slice(0, LIMITS.seoDescription - 1).trim() + "…"; fixes.push("Meta description raccourcie à 160 caractères"); }
    if (b.shortDescription && b.shortDescription.length > LIMITS.shortDescription) { b.shortDescription = b.shortDescription.slice(0, LIMITS.shortDescription - 1).trim() + "…"; fixes.push("Description courte raccourcie à 400 caractères"); }
  }

  // Mentions interdites (marques, faux avis) : non corrigeables automatiquement
  const text = allText(content);
  for (const [re, label] of FORBIDDEN_BRANDS) if (re.test(text)) issues.push({ level: "error", message: `Marque ou personnage sous licence mentionné : « ${label} ». Retirez-le du contenu.` });
  for (const [re, label] of FAKE_CLAIMS) if (re.test(text)) issues.push({ level: "error", message: `Affirmation commerciale invérifiable (${label}) : jamais de faux avis ni de faux chiffres.` });

  return { ok: !issues.some((i) => i.level === "error"), content, fixes, issues };
}

function checkHunt(c: TreasureHunt, expected: number, companion: string | undefined, fixes: string[], issues: QualityIssue[]) {
  if (c.enigmes.length < expected) issues.push({ level: "error", message: `${c.enigmes.length} énigme(s) au lieu de ${expected} attendue(s). Relancez la rédaction ou complétez le contenu.` });
  if (c.enigmes.length > expected) { c.enigmes = c.enigmes.slice(0, expected); fixes.push(`Énigmes réduites à ${expected}`); }
  let renumbered = false;
  c.enigmes.forEach((e, i) => { if (e.numero !== i + 1) { e.numero = i + 1; renumbered = true; } });
  if (renumbered) fixes.push("Énigmes renumérotées de 1 à " + c.enigmes.length);
  const helper = companion?.split(",")[0]?.trim() || c.personnage?.compagnon?.split(",")[0]?.trim() || "Le compagnon";
  let hints = 0;
  for (const e of c.enigmes) {
    if (!e.indice_secours?.trim()) { e.indice_secours = `${helper} dit : cherche ${e.cachette ? `du côté de : ${e.cachette}` : "tout près"} !`; hints++; }
    if (!e.image_description?.trim()) e.image_description = `Cachette : ${e.cachette || "dans la maison"}, un petit parchemin roulé bien visible.`;
    if (e.texte.length > LIMITS.enigme) issues.push({ level: "warning", message: `Énigme ${e.numero} longue (${e.texte.length} caractères) : vérifiez qu'elle tient sur la carte.` });
    if (!e.cachette?.trim()) issues.push({ level: "warning", message: `Énigme ${e.numero} sans cachette indiquée.` });
  }
  if (hints) fixes.push(`${hints} indice(s) de secours complété(s)`);
  const cachettes = c.enigmes.map((e) => e.cachette.trim().toLowerCase()).filter(Boolean);
  const dup = cachettes.filter((x, i) => cachettes.indexOf(x) !== i);
  if (dup.length) issues.push({ level: "warning", message: `Cachettes en double : ${[...new Set(dup)].join(", ")}.` });
  if (c.defis.length < 6) issues.push({ level: "warning", message: `${c.defis.length} défi(s) au lieu de 6.` });
  if (!c.diplome?.texte?.trim()) {
    c.diplome = { ...c.diplome, titre: c.diplome?.titre || "Diplôme d'aventurier", texte: "est nommé(e) aventurier(ère) officiel(le) pour avoir retrouvé le trésor avec courage et malice." };
    fixes.push("Texte du diplôme complété");
  }
  if (!c.invitation?.texte?.trim()) issues.push({ level: "warning", message: "Invitation sans texte." });
  if (!c.guide?.preparation?.length) issues.push({ level: "warning", message: "Guide de l'organisateur sans étapes de préparation." });
}

function checkPranks(c: PranksKit, expected: number, fixes: string[], issues: QualityIssue[]) {
  if (c.idees.length < expected) issues.push({ level: "error", message: `${c.idees.length} idée(s) au lieu de ${expected} attendue(s). Relancez la rédaction ou complétez le contenu.` });
  if (c.idees.length > expected) { c.idees = c.idees.slice(0, expected); fixes.push(`Idées réduites à ${expected}`); }
  let renumbered = false;
  c.idees.forEach((e, i) => { if (e.numero !== i + 1) { e.numero = i + 1; renumbered = true; } });
  if (renumbered) fixes.push("Idées renumérotées de 1 à " + c.idees.length);
  for (const i of c.idees) {
    if (!i.resume?.trim()) issues.push({ level: "warning", message: `Idée ${i.numero} sans résumé.` });
    if (!i.preparation?.length) issues.push({ level: "warning", message: `Idée ${i.numero} sans étapes de préparation.` });
    if ((i.resume ?? "").length > LIMITS.idee) issues.push({ level: "warning", message: `Idée ${i.numero} : résumé long (${i.resume.length} caractères).` });
    if (!i.illustration_description?.trim()) i.illustration_description = `Le lutin prépare la farce « ${i.titre} ».`;
  }
  if (!c.lettre_depart?.trim()) issues.push({ level: "error", message: "Lettre de départ absente." });
  if (c.mots_du_lutin.length < 10) issues.push({ level: "warning", message: `${c.mots_du_lutin.length} mot(s) du lutin au lieu de 10.` });
}

/** Résumé lisible pour la frise du pilote automatique. */
export function summarizeQuality(r: QualityReport): string {
  const parts: string[] = [];
  if (r.fixes.length) parts.push(`Corrigé : ${r.fixes.join(" ; ")}`);
  const warnings = r.issues.filter((i) => i.level === "warning");
  if (warnings.length) parts.push(`À vérifier : ${warnings.map((w) => w.message).join(" ")}`);
  return parts.join(" — ") || "Aucun problème détecté";
}
