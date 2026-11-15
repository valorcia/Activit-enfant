import type { ShopCreatorSubmission } from "../shop/client";

/**
 * Brief du pilote automatique composé depuis l'idée d'une créatrice : un plan de kit (JSON)
 * importé tel quel (pas de plan inventé par l'IA), dont les notes reprennent fidèlement
 * l'idée, le matériel, les étapes, les astuces et les consignes de sécurité, avec le crédit
 * « Une idée de … » à faire figurer dans le livre.
 */

export interface CreatorBriefOptions {
  kitType?: string;
  count?: number;
  priceCents?: number;
  siteSlug?: string | null;
}

/** Types de kits structurés adaptés à un tutoriel d'activité (fiches pas à pas d'abord). */
export const CREATOR_KIT_TYPES = [
  { key: "fiches-sciences", label: "Fiches pas à pas (matériel, étapes, sécurité)" },
  { key: "kit-noel", label: "Idées d'activités de Noël" },
  { key: "chasse-au-tresor", label: "Chasse au trésor" },
  { key: "cahier-coloriage", label: "Cahier de coloriage" },
] as const;

function ageRange(s: Pick<ShopCreatorSubmission, "ageMin" | "ageMax">): string {
  const min = s.ageMin ?? (s.ageMax != null ? Math.max(2, s.ageMax - 3) : 4);
  const max = s.ageMax ?? Math.max(min + 2, 8);
  return `${Math.min(min, max)}-${Math.max(min, max)}`;
}

export function creatorNotes(s: ShopCreatorSubmission): string {
  const lines = [
    `${s.credit}. Tutoriel tiré d'une idée proposée par une créatrice : reste fidèle à son idée et à ses étapes, reformule simplement pour les parents, n'invente ni témoignage ni chiffre.`,
    `Mentionne « ${s.credit} » sur la couverture (sous-titre) et en introduction.`,
    s.durationMinutes ? `Durée indiquée : environ ${s.durationMinutes} minutes.` : "",
    s.materials.length ? `Matériel : ${s.materials.join(" ; ")}.` : "",
    s.steps.length ? `Étapes de la créatrice :\n${s.steps.map((st, i) => `${i + 1}. ${st}`).join("\n")}` : "",
    s.tips ? `Astuces de la créatrice : ${s.tips}` : "",
    `Sécurité : ${s.safetyNotes ? s.safetyNotes : "aucune consigne indiquée par la créatrice"}. Toute étape à risque (verre, chaleur, outils, petites pièces avant 3 ans) porte la mention « avec un adulte ».`,
  ].filter(Boolean);
  // Les notes du plan sont limitées à 4 000 caractères
  const text = lines.join("\n");
  return text.length > 3900 ? `${text.slice(0, 3890)}…` : text;
}

/** Brief (plan de kit JSON) prêt pour `startRun`. */
export function briefFromSubmission(s: ShopCreatorSubmission, opts: CreatorBriefOptions = {}): string {
  const plan = {
    kitType: opts.kitType ?? "fiches-sciences",
    title: s.title.slice(0, 140),
    subtitle: s.credit.slice(0, 240),
    ageRange: ageRange(s),
    universe: "",
    tone: "Chaleureux et complice",
    count: Math.max(1, Math.min(30, opts.count ?? 1)),
    ...(opts.priceCents != null ? { priceCents: opts.priceCents } : {}),
    ...(opts.siteSlug ? { siteSlug: opts.siteSlug } : {}),
    notes: creatorNotes(s),
  };
  return JSON.stringify(plan, null, 2);
}
