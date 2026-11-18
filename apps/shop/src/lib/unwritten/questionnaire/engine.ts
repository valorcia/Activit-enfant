import type { DraftMode } from "../constants";
import { allQuestions, conditionRefs, type Condition, type Question, type QuestionnaireDefinition, type Step } from "./schema";

/**
 * Moteur du questionnaire (fonctions pures, partagées par le navigateur et le serveur) :
 * évaluation des conditions, questions visibles, validation et normalisation des réponses.
 * Le serveur revalide toujours : le navigateur n'est qu'un confort d'affichage.
 */

export type AnswerValue = string | number | string[];
export type Answers = Record<string, AnswerValue>;

/** Qui remplit : tout (self, gift), l'acheteur seul (gift_recipient côté acheteur), le destinataire seul. */
export type Audience = "all" | "buyer" | "subject";

export function audienceForMode(mode: DraftMode | string): Audience {
  return mode === "gift_recipient" ? "buyer" : "all";
}

export function isAnswered(value: AnswerValue | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return value.trim().length > 0;
}

export function evaluateCondition(cond: Condition | undefined, answers: Answers): boolean {
  if (!cond) return true;
  if ("all" in cond) return cond.all.every((c) => evaluateCondition(c, answers));
  if ("any" in cond) return cond.any.some((c) => evaluateCondition(c, answers));
  if ("not" in cond) return !evaluateCondition(cond.not, answers);
  const v = answers[cond.q];
  const expected = cond.value;
  switch (cond.op) {
    case "answered": return isAnswered(v);
    case "empty": return !isAnswered(v);
    case "eq": return isAnswered(v) && !Array.isArray(v) && String(v) === String(expected);
    case "neq": return !(isAnswered(v) && !Array.isArray(v) && String(v) === String(expected));
    case "in": return isAnswered(v) && !Array.isArray(v) && Array.isArray(expected) && expected.includes(String(v));
    case "nin": return !(isAnswered(v) && !Array.isArray(v) && Array.isArray(expected) && expected.includes(String(v)));
    case "includes": return Array.isArray(v) && (Array.isArray(expected) ? expected.some((e) => v.includes(e)) : v.includes(String(expected)));
    default: return false;
  }
}

function inAudience(q: Question, audience: Audience): boolean {
  return audience === "all" || q.audience === audience;
}

export interface VisibleStep { step: Step; index: number; questions: Question[] }

/**
 * Étapes et questions visibles, dans l'ordre. Une condition n'est évaluée qu'avec les réponses
 * des questions déjà visibles : une réponse à une question masquée n'a aucun effet.
 * Le filtre d'audience ne change pas l'évaluation des conditions (réponses de tous les répondants).
 */
export function visibleSteps(def: QuestionnaireDefinition, answers: Answers, audience: Audience = "all"): VisibleStep[] {
  const effective: Answers = {};
  const out: VisibleStep[] = [];
  def.steps.forEach((step, index) => {
    if (!evaluateCondition(step.showIf, effective)) return;
    const questions: Question[] = [];
    for (const q of step.questions) {
      if (!evaluateCondition(q.showIf, effective)) continue;
      if (q.id in answers) effective[q.id] = answers[q.id];
      if (inAudience(q, audience)) questions.push(q);
    }
    if (questions.length) out.push({ step, index, questions });
  });
  return out;
}

export function visibleQuestions(def: QuestionnaireDefinition, answers: Answers, audience: Audience = "all"): Question[] {
  return visibleSteps(def, answers, audience).flatMap((s) => s.questions);
}

/** Retire les réponses inconnues ou devenues masquées (une réponse modifiée peut masquer des questions). */
export function pruneAnswers(def: QuestionnaireDefinition, answers: Answers): Answers {
  const visible = new Set(visibleQuestions(def, answers, "all").filter((q) => q.type !== "info").map((q) => q.id));
  return Object.fromEntries(Object.entries(answers).filter(([k, v]) => visible.has(k) && isAnswered(v)));
}

export type AnswerError = "required" | "tooLong" | "invalidChoice" | "invalidDate" | "invalidNumber" | "consentRequired" | "tooManyPhotos";

/**
 * Photos : la réponse est une liste « ph_<identifiant>[::légende] ». Les fichiers sont privés
 * (src/lib/unwritten/photos.ts) ; le navigateur ne peut que réordonner, légender ou retirer
 * des photos déjà téléversées par lui (voir validateStep).
 */
export const PHOTO_ID_RE = /^ph_[a-z0-9]{24}$/;
export const PHOTO_CAPTION_MAX = 140;
export const DEFAULT_MAX_PHOTOS = 4;

export interface PhotoEntry { id: string; caption: string }

export function parsePhotoEntry(raw: string): PhotoEntry | null {
  const i = raw.indexOf("::");
  const id = i < 0 ? raw : raw.slice(0, i);
  if (!PHOTO_ID_RE.test(id)) return null;
  const caption = i < 0 ? "" : raw.slice(i + 2).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, PHOTO_CAPTION_MAX);
  return { id, caption };
}

export function formatPhotoEntry(e: PhotoEntry): string {
  return e.caption ? `${e.id}::${e.caption}` : e.id;
}

export function photoEntries(value: AnswerValue | undefined): PhotoEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(parsePhotoEntry).filter((x): x is PhotoEntry => !!x);
}

/** Identifiants de toutes les photos citées par des réponses (suppression des fichiers). */
export function photoIdsIn(answers: Answers): string[] {
  const ids = new Set<string>();
  for (const v of Object.values(answers)) for (const e of photoEntries(v)) ids.add(e.id);
  return [...ids];
}

const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

export function defaultMaxLength(q: Question): number {
  return q.maxLength ?? (q.type === "longtext" ? 1200 : 120);
}

/** Normalise une valeur brute (formulaire) selon le type ; `undefined` = pas de réponse. */
export function normalizeAnswer(q: Question, raw: unknown): AnswerValue | undefined {
  if (raw === undefined || raw === null) return undefined;
  switch (q.type) {
    case "info": return undefined;
    case "multi": {
      const list = (Array.isArray(raw) ? raw : [raw]).map((x) => String(x).trim()).filter(Boolean);
      return list.length ? [...new Set(list)] : undefined;
    }
    case "photos": {
      const seen = new Set<string>();
      const list: string[] = [];
      for (const x of Array.isArray(raw) ? raw : [raw]) {
        const e = parsePhotoEntry(String(x));
        if (!e || seen.has(e.id)) continue;
        seen.add(e.id);
        list.push(formatPhotoEntry(e));
      }
      return list.length ? list : undefined;
    }
    case "number": {
      if (typeof raw === "string" && raw.trim() === "") return undefined;
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
      return Number.isFinite(n) ? n : String(raw);
    }
    default: {
      // Texte : espaces superflus retirés, caractères de contrôle supprimés (retours à la ligne conservés)
      const s = String(Array.isArray(raw) ? raw[0] ?? "" : raw).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim();
      return s ? s : undefined;
    }
  }
}

export function checkAnswer(q: Question, value: AnswerValue | undefined, opts: { consent: boolean }): AnswerError | null {
  if (!isAnswered(value)) return q.required ? "required" : null;
  if (q.sensitive && !opts.consent) return "consentRequired";
  switch (q.type) {
    case "single":
      return typeof value === "string" && q.options!.some((o) => o.value === value) ? null : "invalidChoice";
    case "multi": {
      if (!Array.isArray(value) || value.some((v) => !q.options!.some((o) => o.value === v))) return "invalidChoice";
      return q.maxChoices && value.length > q.maxChoices ? "invalidChoice" : null;
    }
    case "number": {
      if (typeof value !== "number") return "invalidNumber";
      if ((q.min !== undefined && value < q.min) || (q.max !== undefined && value > q.max)) return "invalidNumber";
      return null;
    }
    case "date":
      return typeof value === "string" && DATE_RE.test(value) ? null : "invalidDate";
    case "photos": {
      if (!Array.isArray(value) || photoEntries(value).length !== value.length) return "invalidChoice";
      return value.length > (q.maxFiles ?? DEFAULT_MAX_PHOTOS) ? "tooManyPhotos" : null;
    }
    default:
      return typeof value === "string" && value.length <= defaultMaxLength(q) ? null : "tooLong";
  }
}

export interface StepValidation {
  ok: boolean;
  /** Réponses fusionnées (existantes + étape), normalisées et nettoyées des questions masquées. */
  answers: Answers;
  errors: Record<string, AnswerError>;
  /** L'étape contient une réponse sensible (le consentement est donc requis ou déjà donné). */
  hasSensitive: boolean;
}

/**
 * Valide les réponses d'une étape. Les réponses des autres étapes sont conservées ; la visibilité
 * est recalculée avec les nouvelles valeurs (une question devenue visible doit être répondue).
 */
export function validateStep(
  def: QuestionnaireDefinition,
  stepId: string,
  input: Record<string, unknown>,
  existing: Answers,
  opts: { consent: boolean; audience?: Audience },
): StepValidation {
  const step = def.steps.find((s) => s.id === stepId);
  if (!step) return { ok: false, answers: existing, errors: { _step: "invalidChoice" } as Record<string, AnswerError>, hasSensitive: false };
  const merged: Answers = { ...existing };
  const audience = opts.audience ?? "all";
  for (const q of step.questions) {
    // Seules les questions du répondant sont modifiables (cadeau : l'acheteur ne remplit pas celles du destinataire)
    if (q.type === "info" || !inAudience(q, audience)) continue;
    let value = normalizeAnswer(q, input[q.id]);
    // Photos : seules celles déjà enregistrées pour ce répondant sont acceptées (téléversement à part)
    if (q.type === "photos" && Array.isArray(value)) {
      const known = new Set(photoEntries(existing[q.id]).map((e) => e.id));
      const kept = value.filter((v) => known.has(parsePhotoEntry(v)!.id));
      value = kept.length ? kept : undefined;
    }
    if (value === undefined) delete merged[q.id];
    else merged[q.id] = value;
  }
  const visible = visibleSteps(def, merged, audience).find((s) => s.step.id === stepId)?.questions ?? [];
  const errors: Record<string, AnswerError> = {};
  let hasSensitive = false;
  for (const q of visible) {
    if (q.type === "info") continue;
    const err = checkAnswer(q, merged[q.id], opts);
    if (err) errors[q.id] = err;
    if (q.sensitive && isAnswered(merged[q.id])) hasSensitive = true;
  }
  return { ok: Object.keys(errors).length === 0, answers: pruneAnswers(def, merged), errors, hasSensitive };
}

/** Questions obligatoires visibles sans réponse valide (récapitulatif, paiement, envoi du cadeau). */
export function missingAnswers(def: QuestionnaireDefinition, answers: Answers, opts: { consent: boolean; audience?: Audience }): string[] {
  return visibleQuestions(def, answers, opts.audience ?? "all")
    .filter((q) => q.type !== "info" && checkAnswer(q, answers[q.id], opts) !== null)
    .map((q) => q.id);
}

export function hasSensitiveAnswers(def: QuestionnaireDefinition, answers: Answers): boolean {
  return allQuestions(def).some((q) => q.sensitive && isAnswered(answers[q.id]));
}

/** Supprime les réponses sensibles (retrait du consentement). */
export function withoutSensitive(def: QuestionnaireDefinition, answers: Answers): Answers {
  const sensitive = new Set(allQuestions(def).filter((q) => q.sensitive).map((q) => q.id));
  return Object.fromEntries(Object.entries(answers).filter(([k]) => !sensitive.has(k)));
}

/**
 * Contrôle de sobriété (avertissements, non bloquant) : nombre de questions visibles par parcours,
 * en essayant les combinaisons des choix uniques cités par des conditions (≤ 512 combinaisons).
 */
export function lintDefinition(def: QuestionnaireDefinition, opts: { min?: number; max?: number } = {}): { min: number; max: number; warnings: string[] } {
  const minWanted = opts.min ?? 5;
  const maxWanted = opts.max ?? 32;
  const questions = allQuestions(def);
  const referenced = new Set<string>();
  for (const s of def.steps) {
    if (s.showIf) conditionRefs(s.showIf).forEach((r) => referenced.add(r.q));
    for (const q of s.questions) if (q.showIf) conditionRefs(q.showIf).forEach((r) => referenced.add(r.q));
  }
  const drivers = questions.filter((q) => referenced.has(q.id) && q.type === "single" && q.options);
  let combos: Answers[] = [{}];
  for (const d of drivers) {
    const next: Answers[] = [];
    for (const c of combos) for (const o of [...d.options!, null]) next.push(o ? { ...c, [d.id]: o.value } : c);
    combos = next.slice(0, 512);
  }
  let min = Infinity;
  let max = 0;
  for (const combo of combos) {
    // Hypothèse : toutes les autres questions sont répondues (« answered » vrai)
    const filled: Answers = { ...Object.fromEntries(questions.filter((q) => !(q.id in combo)).map((q) => [q.id, q.type === "multi" ? ["x"] : "x"])), ...combo };
    const n = visibleQuestions(def, filled).filter((q) => q.type !== "info").length;
    min = Math.min(min, n);
    max = Math.max(max, n);
  }
  const warnings: string[] = [];
  if (max > maxWanted) warnings.push(`Un parcours affiche ${max} questions : visez ${maxWanted} au plus.`);
  if (min < minWanted) warnings.push(`Un parcours n'affiche que ${min} questions : visez ${minWanted} au moins.`);
  return { min: Number.isFinite(min) ? min : 0, max, warnings };
}
