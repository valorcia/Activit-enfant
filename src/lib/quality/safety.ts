import type { ActivityContent } from "../schemas/activity";

/**
 * Évaluation des risques. Ce module SIGNALE et BLOQUE en attendant une validation
 * humaine ; il ne certifie jamais qu'une activité est sûre.
 */
const DANGEROUS_PATTERNS: { re: RegExp; note: string; block: boolean; minAge?: number }[] = [
  { re: /\b(cutter|scalpel|lame de rasoir|couteau)\b/i, note: "Outil tranchant (cutter/couteau) : manipulation par un adulte uniquement.", block: true },
  { re: /\b(allumette|briquet|flamme|bougie|feu)\b/i, note: "Présence de feu ou de flamme : supervision adulte obligatoire.", block: true },
  { re: /\b(eau bouillante|four|plaque de cuisson|micro-ondes|huile chaude)\b/i, note: "Source de chaleur élevée : risque de brûlure.", block: true },
  { re: /\b(javel|ammoniaque|acide chlorhydrique|soude caustique|alcool à brûler|white spirit|acétone|solvant)\b/i, note: "Substance chimique dangereuse détectée : activité interdite sans validation humaine.", block: true },
  { re: /\b(pile|batterie|électri)/i, note: "Électricité : vérifier qu'il s'agit uniquement de piles basse tension (≤ 4,5 V).", block: false },
  { re: /\b(secteur|220 ?v|prise électrique)\b/i, note: "Courant secteur mentionné : interdit.", block: true },
  { re: /\b(aiguille|épingle|punaise|clou|vis|agrafeuse|perceuse|marteau|scie)\b/i, note: "Outil ou objet pointu : une aide adulte est nécessaire.", block: false },
  { re: /\b(aimants?|billes?|perles?|boutons?|graines?|petites? pièces?)\b/i, note: "Petites pièces : risque d'ingestion pour les plus jeunes.", block: false, minAge: 6 },
  { re: /\b(sèche-cheveux|fer à repasser|pistolet à colle)\b/i, note: "Appareil chauffant : manipulation par un adulte.", block: false },
  { re: /\b(bain|baignoire|piscine|plan d'eau)\b/i, note: "Eau profonde : surveillance constante.", block: false },
];

export function assessSafety(content: ActivityContent) {
  const text = [content.description, ...content.materials.map((m) => `${m.name} ${m.note}`), ...content.steps.map((s) => `${s.title} ${s.instruction} ${s.tip}`), content.challenge.body].join("\n");
  const notes: string[] = [];
  let blocked = false;
  const minAge = Number(content.ageRange.split("-")[0]);
  for (const p of DANGEROUS_PATTERNS) {
    if (p.re.test(text)) {
      notes.push(p.note);
      if (p.block) blocked = true;
      if (p.minAge && minAge < p.minAge) {
        notes.push(`Public ${content.ageRange} : petites pièces inadaptées aux moins de ${p.minAge} ans → validation humaine requise.`);
        blocked = true;
      }
    }
  }
  if (content.safety.hazards.includes("substances") || content.safety.hazards.includes("heat") || content.safety.hazards.includes("electricity")) {
    notes.push("La fiche déclare un risque substances/chaleur/électricité : validation humaine requise.");
    blocked = true;
  }
  if (content.safety.adultSupervision === "required" && minAge < 6) {
    notes.push("Supervision adulte obligatoire pour un public préscolaire : vérifier la pertinence de l'activité.");
  }
  if (content.safety.adultSupervision === "none" && (content.safety.hazards.includes("tools") || content.safety.hazards.includes("sharp"))) {
    notes.push("Incohérence : outils déclarés mais aucune supervision adulte.");
  }
  return { blocked, notes };
}
