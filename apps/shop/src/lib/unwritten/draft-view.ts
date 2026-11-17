import "server-only";
import type { Locale } from "./constants";
import { activeQuestionnaire, draftAnswers, draftDefinition, getDraft, resolveDraftState, type DraftState, type DraftWithRefs } from "./drafts";
import { pick } from "./i18n";
import { audienceForMode, isAnswered, visibleSteps, type AnswerValue, type Answers } from "./questionnaire/engine";
import { definitionSchema, type Question, type QuestionnaireDefinition } from "./questionnaire/schema";
import { cookieDraftIds } from "./session";

/** Brouillon de ce navigateur pour un produit, avec son état (transitions automatiques appliquées). */
export async function browserDraft(productId: string): Promise<{ draft: DraftWithRefs; state: DraftState } | null> {
  const ids = await cookieDraftIds();
  for (const id of [...ids].reverse()) {
    const draft = await getDraft(id);
    if (!draft || draft.productId !== productId) continue;
    const state = await resolveDraftState(draft);
    if (state === "editable" || state === "checkout") return { draft, state };
  }
  return null;
}

export interface QuestionnaireView {
  definition: QuestionnaireDefinition;
  answers: Answers;
  mode: string;
  /** Étapes du parcours : « mode » (choix du répondant) puis les étapes visibles. */
  steps: string[];
}

export async function questionnaireView(productId: string, draft: DraftWithRefs | null, modeHint?: string | null): Promise<QuestionnaireView | null> {
  let definition: QuestionnaireDefinition;
  if (draft) definition = draftDefinition(draft);
  else {
    const q = await activeQuestionnaire(productId);
    const parsed = q ? definitionSchema.safeParse(q.definition) : null;
    if (!parsed?.success) return null;
    definition = parsed.data;
  }
  const mode = draft?.mode ?? (modeHint === "gift" || modeHint === "gift_recipient" ? modeHint : "self");
  const answers = draft ? draftAnswers(draft) : {};
  const steps = ["mode", ...visibleSteps(definition, answers, audienceForMode(mode)).map((s) => s.step.id)];
  return { definition, answers, mode, steps };
}

/** Réponse lisible pour le récapitulatif (libellés d'options dans la langue). */
export function displayAnswer(q: Question, value: AnswerValue | undefined, locale: Locale): string | null {
  if (!isAnswered(value)) return null;
  if (q.options) {
    const list = Array.isArray(value) ? value : [String(value)];
    return list.map((v) => pick(q.options!.find((o) => o.value === v)?.label, locale) || v).join(", ");
  }
  return String(value);
}
