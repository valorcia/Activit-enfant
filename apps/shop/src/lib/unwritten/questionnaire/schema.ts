import { z } from "zod";

/**
 * Définition d'un questionnaire dynamique (JSON stocké en base, `Questionnaire.definition`).
 * Aucune modification de code n'est nécessaire pour un nouveau produit : étapes, questions,
 * types, conditions d'affichage, champs obligatoires et sensibles, textes EN/FR.
 *
 * Règles vérifiées à l'enregistrement (`parseDefinition`) :
 *  - identifiants uniques (étapes, questions, options) ;
 *  - une condition ne cite que des questions situées AVANT elle (pas de dépendance circulaire) ;
 *  - les valeurs citées par une condition existent dans les options de la question ;
 *  - les textes existent dans chaque langue de la vitrine (en, fr).
 */

const text = (max: number) => z.object({ en: z.string().trim().min(1).max(max), fr: z.string().trim().min(1).max(max) });
export const localizedSchema = text;

const idSchema = z.string().regex(/^[a-z][a-zA-Z0-9_]{0,40}$/, "Identifiant : lettre minuscule puis lettres, chiffres ou _ (41 caractères au plus)");
const optionValueSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,40}$/, "Valeur d'option : minuscules, chiffres, - ou _");

export const QUESTION_TYPES = ["single", "multi", "text", "longtext", "date", "number", "info"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const CONDITION_OPS = ["eq", "neq", "in", "nin", "includes", "answered", "empty"] as const;

export type Condition =
  | { q: string; op: (typeof CONDITION_OPS)[number]; value?: string | number | string[] }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

const leafCondition = z.object({
  q: idSchema,
  op: z.enum(CONDITION_OPS),
  value: z.union([z.string().max(60), z.number(), z.array(z.string().max(60)).max(20)]).optional(),
}).strict();

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    leafCondition,
    z.object({ all: z.array(conditionSchema).min(1).max(10) }).strict(),
    z.object({ any: z.array(conditionSchema).min(1).max(10) }).strict(),
    z.object({ not: conditionSchema }).strict(),
  ]),
);

export const optionSchema = z.object({
  value: optionValueSchema,
  label: text(80),
  description: text(200).optional(),
});

export const questionSchema = z.object({
  id: idSchema,
  type: z.enum(QUESTION_TYPES),
  label: text(200),
  help: text(400).optional(),
  placeholder: text(120).optional(),
  required: z.boolean().default(false),
  /** Donnée sensible (souvenirs intimes, santé, secrets…) : consentement explicite obligatoire. */
  sensitive: z.boolean().default(false),
  /**
   * Qui répond en mode « cadeau rempli par le destinataire » :
   * `buyer` = l'acheteur (édition, dédicace…), `subject` = la personne concernée par le livre.
   */
  audience: z.enum(["buyer", "subject"]).default("subject"),
  /** Réservé au livre collaboratif (volet viral) : question ouverte aux contributions de proches. */
  contributable: z.boolean().default(false),
  options: z.array(optionSchema).min(2).max(12).optional(),
  maxChoices: z.number().int().min(1).max(12).optional(),
  maxLength: z.number().int().min(1).max(4000).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  showIf: conditionSchema.optional(),
});
export type Question = z.infer<typeof questionSchema>;

export const stepSchema = z.object({
  id: idSchema,
  title: text(120),
  description: text(400).optional(),
  showIf: conditionSchema.optional(),
  questions: z.array(questionSchema).min(1).max(6),
});
export type Step = z.infer<typeof stepSchema>;

export const MAX_QUESTIONS = 20;
/** Étapes ajoutées par la vitrine (choix du répondant, récapitulatif). */
export const RESERVED_STEP_IDS = ["mode", "review"];

const baseDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  intro: text(400).optional(),
  steps: z.array(stepSchema).min(1).max(8),
});
export type QuestionnaireDefinition = z.infer<typeof baseDefinitionSchema>;

/** Identifiants des questions citées par une condition. */
export function conditionRefs(c: Condition): Array<{ q: string; value?: string | number | string[] }> {
  if ("all" in c) return c.all.flatMap(conditionRefs);
  if ("any" in c) return c.any.flatMap(conditionRefs);
  if ("not" in c) return conditionRefs(c.not);
  return [{ q: c.q, value: c.value }];
}

export const definitionSchema = baseDefinitionSchema.superRefine((def, ctx) => {
  const stepIds = new Set<string>();
  const seen = new Map<string, Question>();
  let count = 0;
  const checkCondition = (cond: Condition | undefined, path: (string | number)[], available: Map<string, Question>) => {
    if (!cond) return;
    for (const ref of conditionRefs(cond)) {
      const target = available.get(ref.q);
      if (!target) {
        ctx.addIssue({ code: "custom", path, message: `La condition cite « ${ref.q} », qui doit être une question placée avant` });
        continue;
      }
      if (target.options && ref.value !== undefined) {
        const values = Array.isArray(ref.value) ? ref.value : [String(ref.value)];
        const unknown = values.filter((v) => !target.options!.some((o) => o.value === v));
        if (unknown.length) ctx.addIssue({ code: "custom", path, message: `Valeur inconnue pour « ${ref.q} » : ${unknown.join(", ")}` });
      }
    }
  };
  def.steps.forEach((step, si) => {
    if (stepIds.has(step.id)) ctx.addIssue({ code: "custom", path: ["steps", si, "id"], message: `Étape en double : ${step.id}` });
    if (RESERVED_STEP_IDS.includes(step.id)) ctx.addIssue({ code: "custom", path: ["steps", si, "id"], message: `Identifiant d'étape réservé : ${step.id}` });
    stepIds.add(step.id);
    checkCondition(step.showIf, ["steps", si, "showIf"], new Map(seen));
    step.questions.forEach((q, qi) => {
      const path = ["steps", si, "questions", qi];
      if (seen.has(q.id)) ctx.addIssue({ code: "custom", path: [...path, "id"], message: `Question en double : ${q.id}` });
      const needsOptions = q.type === "single" || q.type === "multi";
      if (needsOptions && !q.options) ctx.addIssue({ code: "custom", path: [...path, "options"], message: "Options obligatoires pour un choix" });
      if (!needsOptions && q.options) ctx.addIssue({ code: "custom", path: [...path, "options"], message: "Options réservées aux questions à choix" });
      if (q.options && new Set(q.options.map((o) => o.value)).size !== q.options.length) ctx.addIssue({ code: "custom", path: [...path, "options"], message: "Valeurs d'options en double" });
      if (q.type === "info" && (q.required || q.sensitive)) ctx.addIssue({ code: "custom", path, message: "Un texte d'information ne peut être ni obligatoire ni sensible" });
      if (q.maxChoices && q.type !== "multi") ctx.addIssue({ code: "custom", path: [...path, "maxChoices"], message: "maxChoices réservé aux choix multiples" });
      // Condition d'une question : questions des étapes précédentes et questions précédentes de la même étape
      checkCondition(q.showIf, [...path, "showIf"], new Map(seen));
      seen.set(q.id, q);
      if (q.type !== "info") count += 1;
    });
  });
  if (count > MAX_QUESTIONS) ctx.addIssue({ code: "custom", path: ["steps"], message: `Trop de questions (${count}) : ${MAX_QUESTIONS} au plus, et 5 à 8 visibles par parcours` });
});

export type DefinitionParse = { ok: true; definition: QuestionnaireDefinition } | { ok: false; errors: string[] };

/** Valide une définition (objet ou texte JSON) et renvoie des erreurs lisibles, en français. */
export function parseDefinition(input: unknown): DefinitionParse {
  let raw = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [`JSON invalide : ${e instanceof Error ? e.message : "erreur de syntaxe"}`] };
    }
  }
  const parsed = definitionSchema.safeParse(raw);
  if (parsed.success) return { ok: true, definition: parsed.data };
  return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "définition"} : ${i.message}`) };
}

export function allQuestions(def: QuestionnaireDefinition): Question[] {
  return def.steps.flatMap((s) => s.questions);
}
