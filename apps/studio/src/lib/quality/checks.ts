import { prisma } from "../db";
import { ActivityContentSchema, type ActivityContent } from "../schemas/activity";
import { assessSafety } from "./safety";
import type { IssueSeverity } from "@prisma/client";

export interface Issue {
  severity: IssueSeverity;
  code: string;
  message: string;
}

const STOPWORDS = new Set(["de", "des", "du", "la", "le", "les", "un", "une", "en", "et", "ou", "à", "d", "l", "pour", "avec", "sur", "par", "au", "aux", "ce", "cette", "ces", "ton", "ta", "tes"]);

function tokens(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map((t) => t.replace(/s$/, ""));
}

/** Contrôles automatiques sur le contenu d'une fiche (purs, testables). */
export function checkActivityContent(raw: unknown): Issue[] {
  const issues: Issue[] = [];
  const parsed = ActivityContentSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) issues.push({ severity: "ERROR", code: "schema", message: `${i.path.join(".") || "racine"} : ${i.message}` });
    return issues;
  }
  const c: ActivityContent = parsed.data;

  // Champs vides ou trop courts
  if (!c.subtitle) issues.push({ severity: "INFO", code: "missing_field", message: "Pas de sous-titre." });
  if (!c.funFact) issues.push({ severity: "INFO", code: "missing_field", message: "Pas d'anecdote (funFact)." });
  if (c.explanation.keyWords.length === 0) issues.push({ severity: "WARNING", code: "missing_field", message: "Aucun mot-clé dans l'explication." });

  // Matériel absent des instructions
  const stepsText = tokens(c.steps.map((s) => `${s.title} ${s.instruction}`).join(" "));
  const stepSet = new Set(stepsText);
  for (const m of c.materials) {
    if (m.optional) continue;
    const mt = tokens(m.name);
    if (mt.length && !mt.some((t) => stepSet.has(t) || [...stepSet].some((s) => s.startsWith(t.slice(0, 5)) && t.length >= 5)))
      issues.push({ severity: "WARNING", code: "material_unused", message: `Le matériel « ${m.name} » n'apparaît dans aucune étape.` });
  }

  // Étapes incohérentes
  c.steps.forEach((s, i) => {
    if (s.instruction.length < 40) issues.push({ severity: "WARNING", code: "step_short", message: `Étape ${i + 1} : instruction très courte.` });
    if (/étape \d+/i.test(s.title)) issues.push({ severity: "INFO", code: "step_title", message: `Étape ${i + 1} : le titre contient un numéro, la numérotation est automatique.` });
  });
  const titles = new Set(c.steps.map((s) => s.title.toLowerCase()));
  if (titles.size < c.steps.length) issues.push({ severity: "WARNING", code: "step_duplicate", message: "Deux étapes portent le même titre." });

  // Durée manifestement incohérente
  const expected = c.steps.length * 6 + c.materials.length * 1.5;
  if (c.durationMinutes < expected * 0.5) issues.push({ severity: "WARNING", code: "duration", message: `Durée ${c.durationMinutes} min probablement trop courte pour ${c.steps.length} étapes.` });
  if (c.durationMinutes > Math.max(120, expected * 4)) issues.push({ severity: "WARNING", code: "duration", message: `Durée ${c.durationMinutes} min probablement trop longue.` });

  // Lisibilité selon l'âge
  const minAge = Number(c.ageRange.split("-")[0]);
  const longSentences = c.steps.filter((s) => s.instruction.split(/[.!?]/).some((p) => p.trim().split(/\s+/).length > (minAge < 6 ? 18 : 30))).length;
  if (longSentences > 0) issues.push({ severity: "INFO", code: "readability", message: `${longSentences} étape(s) contiennent des phrases longues pour l'âge visé.` });

  // Orthographe / typographie élémentaire
  const all = [c.description, c.explanation.body, ...c.steps.map((s) => s.instruction)].join(" ");
  if (/\s[,.;:!?]/.test(all.replace(/\s[!?;:]/g, ""))) issues.push({ severity: "INFO", code: "typo", message: "Espace avant une virgule ou un point." });
  if (/  +/.test(all)) issues.push({ severity: "INFO", code: "typo", message: "Doubles espaces détectés." });
  if (/\b(\w+) \1\b/i.test(all)) issues.push({ severity: "INFO", code: "typo", message: "Mot répété deux fois de suite." });

  // Sécurité
  const safety = assessSafety(c);
  for (const n of safety.notes) issues.push({ severity: safety.blocked ? "BLOCKER" : "WARNING", code: "safety", message: n });
  if (c.safety.warnings.length === 0 && c.safety.hazards.length > 0) issues.push({ severity: "WARNING", code: "safety", message: "Des risques sont déclarés mais aucune consigne de sécurité n'est rédigée." });

  return issues;
}

/** Contrôles sur les illustrations d'une activité (présence, résolution, démo). */
export async function checkActivityIllustrations(activityId: string, content: ActivityContent | null, requireSteps: boolean): Promise<Issue[]> {
  const issues: Issue[] = [];
  if (!content) return issues;
  const ills = await prisma.illustration.findMany({ where: { activityId, isCurrent: true }, include: { asset: true } });
  const final = ills.find((i) => i.kind === "FINAL");
  if (!final || !final.assetId) issues.push({ severity: "ERROR", code: "illustration_missing", message: "Illustration du résultat final absente." });
  else {
    if (final.isDemo) issues.push({ severity: "WARNING", code: "illustration_demo", message: "L'illustration finale est une image de démonstration." });
    if (final.status === "REJECTED") issues.push({ severity: "ERROR", code: "illustration_rejected", message: "L'illustration finale a été refusée : régénération nécessaire." });
    if (final.status === "GENERATED") issues.push({ severity: "WARNING", code: "illustration_unreviewed", message: "L'illustration finale n'a pas été validée visuellement." });
    if ((final.asset?.width ?? 0) < 1000) issues.push({ severity: "WARNING", code: "illustration_resolution", message: `Illustration finale de résolution faible (${final.asset?.width}px).` });
  }
  if (requireSteps) {
    content.steps.forEach((_, i) => {
      const s = ills.find((x) => x.kind === "STEP" && x.stepIndex === i);
      if (!s || !s.assetId) issues.push({ severity: "WARNING", code: "illustration_missing", message: `Illustration de l'étape ${i + 1} absente.` });
      else if (s.status === "REJECTED") issues.push({ severity: "ERROR", code: "illustration_rejected", message: `Illustration de l'étape ${i + 1} refusée.` });
      else if (s.isDemo) issues.push({ severity: "INFO", code: "illustration_demo", message: `Étape ${i + 1} : image de démonstration.` });
    });
  }
  return issues;
}

/** Détection de doublons / activités trop similaires dans la bibliothèque. */
export async function findSimilarActivities(activityId: string, content: ActivityContent): Promise<Issue[]> {
  const others = await prisma.activity.findMany({ where: { id: { not: activityId }, status: { not: "ARCHIVED" } }, include: { currentVersion: true }, take: 500 });
  const issues: Issue[] = [];
  const mine = new Set(tokens(`${content.title} ${content.materials.map((m) => m.name).join(" ")} ${content.explanation.title}`));
  for (const o of others) {
    const oc = o.currentVersion ? ActivityContentSchema.safeParse(o.currentVersion.content) : null;
    const text = oc?.success ? `${oc.data.title} ${oc.data.materials.map((m) => m.name).join(" ")} ${oc.data.explanation.title}` : o.title;
    const theirs = new Set(tokens(text));
    if (theirs.size === 0) continue;
    const inter = [...mine].filter((t) => theirs.has(t)).length;
    const jaccard = inter / (mine.size + theirs.size - inter);
    const sameTitle = o.title.trim().toLowerCase() === content.title.trim().toLowerCase();
    if (sameTitle) issues.push({ severity: "ERROR", code: "duplicate", message: `Doublon : « ${o.title} » existe déjà dans la bibliothèque.` });
    else if (jaccard > 0.55) issues.push({ severity: "WARNING", code: "similar", message: `Très similaire à « ${o.title} » (${Math.round(jaccard * 100)} % de recouvrement).` });
  }
  return issues;
}

/** Exécute tous les contrôles d'une activité et met à jour la table QualityIssue. */
export async function runActivityChecks(activityId: string, opts?: { requireSteps?: boolean }) {
  const a = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { currentVersion: true } });
  const content = a.currentVersion ? ActivityContentSchema.safeParse(a.currentVersion.content) : null;
  const issues: Issue[] = [];
  if (!a.currentVersion) issues.push({ severity: "ERROR", code: "missing_content", message: "La fiche n'a pas encore été rédigée." });
  else issues.push(...checkActivityContent(a.currentVersion.content));
  const c = content?.success ? content.data : null;
  issues.push(...(await checkActivityIllustrations(activityId, c, opts?.requireSteps ?? false)));
  if (c) issues.push(...(await findSimilarActivities(activityId, c)));
  await prisma.$transaction([
    prisma.qualityIssue.deleteMany({ where: { activityId } }),
    prisma.qualityIssue.createMany({ data: issues.map((i) => ({ activityId, ...i })) }),
  ]);
  return issues;
}
