import { describe, expect, it } from "vitest";
import { STARTER_DEFINITIONS } from "@/lib/unwritten/questionnaire/definitions";
import { definitionSchema, parseDefinition, type QuestionnaireDefinition } from "@/lib/unwritten/questionnaire/schema";
import { audienceForMode, evaluateCondition, lintDefinition, missingAnswers, pruneAnswers, validateStep, visibleQuestions, visibleSteps } from "@/lib/unwritten/questionnaire/engine";

/** Questionnaire dynamique : conditions d'affichage, validation des définitions et des réponses. */

const t = (s: string) => ({ en: s, fr: `${s} (fr)` });
const secret = definitionSchema.parse(STARTER_DEFINITIONS["secret-book"]);
const before = definitionSchema.parse(STARTER_DEFINITIONS["before-its-too-late"]);
const movie = definitionSchema.parse(STARTER_DEFINITIONS["movie-of-my-life"]);

function mini(extra: Partial<QuestionnaireDefinition> = {}): unknown {
  return {
    schemaVersion: 1,
    steps: [
      { id: "s1", title: t("One"), questions: [{ id: "kind", type: "single", required: true, label: t("Kind"), options: [{ value: "a", label: t("A") }, { value: "b", label: t("B") }] }] },
      { id: "s2", title: t("Two"), questions: [{ id: "name", type: "text", required: true, label: t("Name"), showIf: { q: "kind", op: "eq", value: "a" } }, { id: "note", type: "longtext", maxLength: 10, label: t("Note") }] },
    ],
    ...extra,
  };
}

describe("conditions d'affichage", () => {
  const answers = { edition: "couple", tags: ["x", "y"], empty: "  " };
  it("évalue chaque opérateur", () => {
    expect(evaluateCondition({ q: "edition", op: "eq", value: "couple" }, answers)).toBe(true);
    expect(evaluateCondition({ q: "edition", op: "neq", value: "couple" }, answers)).toBe(false);
    expect(evaluateCondition({ q: "missing", op: "neq", value: "couple" }, answers)).toBe(true);
    expect(evaluateCondition({ q: "edition", op: "in", value: ["family", "couple"] }, answers)).toBe(true);
    expect(evaluateCondition({ q: "edition", op: "nin", value: ["family"] }, answers)).toBe(true);
    expect(evaluateCondition({ q: "tags", op: "includes", value: "y" }, answers)).toBe(true);
    expect(evaluateCondition({ q: "empty", op: "answered" }, answers)).toBe(false);
    expect(evaluateCondition({ q: "empty", op: "empty" }, answers)).toBe(true);
  });
  it("combine all, any et not", () => {
    expect(evaluateCondition({ all: [{ q: "edition", op: "eq", value: "couple" }, { q: "tags", op: "includes", value: "x" }] }, answers)).toBe(true);
    expect(evaluateCondition({ any: [{ q: "edition", op: "eq", value: "family" }, { q: "tags", op: "includes", value: "z" }] }, answers)).toBe(false);
    expect(evaluateCondition({ not: { q: "edition", op: "eq", value: "family" } }, answers)).toBe(true);
  });
  it("affiche les questions selon les réponses précédentes (The Secret Book)", () => {
    const couple = visibleQuestions(secret, { edition: "couple" }).map((q) => q.id);
    expect(couple).toContain("partnerName");
    expect(couple).not.toContain("groupNames");
    expect(couple).not.toContain("intention");
    const growth = visibleQuestions(secret, { edition: "growth" }).map((q) => q.id);
    expect(growth).toContain("intention");
    expect(growth).not.toContain("shared");
    expect(growth).not.toContain("partnerName");
  });
  it("ignore la réponse d'une question masquée (pas d'effet en cascade)", () => {
    const def = parseDefinition({
      schemaVersion: 1,
      steps: [{ id: "s1", title: t("S"), questions: [
        { id: "a", type: "single", label: t("A"), options: [{ value: "x", label: t("X") }, { value: "y", label: t("Y") }] },
        { id: "b", type: "single", label: t("B"), showIf: { q: "a", op: "eq", value: "x" }, options: [{ value: "on", label: t("On") }, { value: "off", label: t("Off") }] },
        { id: "c", type: "text", label: t("C"), showIf: { q: "b", op: "eq", value: "on" } },
      ] }],
    });
    expect(def.ok).toBe(true);
    if (!def.ok) return;
    expect(visibleQuestions(def.definition, { a: "x", b: "on" }).map((q) => q.id)).toEqual(["a", "b", "c"]);
    // a change → b masquée → sa réponse ne rend plus c visible
    expect(visibleQuestions(def.definition, { a: "y", b: "on" }).map((q) => q.id)).toEqual(["a"]);
    expect(pruneAnswers(def.definition, { a: "y", b: "on", c: "z", unknown: "1" })).toEqual({ a: "y" });
  });
  it("filtre par répondant pour l'option cadeau (acheteur / destinataire)", () => {
    expect(audienceForMode("gift_recipient")).toBe("buyer");
    expect(audienceForMode("self")).toBe("all");
    const buyer = visibleQuestions(before, { edition: "children" }, "buyer").map((q) => q.id);
    expect(buyer).toEqual(["edition", "dedication"]);
    const subject = visibleQuestions(before, { edition: "children" }, "subject").map((q) => q.id);
    expect(subject).toContain("childrenAge"); // condition évaluée avec la réponse de l'acheteur
    expect(subject).not.toContain("edition");
  });
});

describe("validation des réponses d'une étape", () => {
  const def = definitionSchema.parse(mini());
  it("exige les réponses obligatoires visibles seulement", () => {
    expect(validateStep(def, "s2", {}, { kind: "b" }, { consent: false }).ok).toBe(true);
    const r = validateStep(def, "s2", {}, { kind: "a" }, { consent: false });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual({ name: "required" });
  });
  it("contrôle longueur, choix et dates", () => {
    expect(validateStep(def, "s2", { note: "x".repeat(11) }, { kind: "b" }, { consent: false }).errors).toEqual({ note: "tooLong" });
    expect(validateStep(def, "s1", { kind: "zz" }, {}, { consent: false }).errors).toEqual({ kind: "invalidChoice" });
    const r = validateStep(movie, "hero", { heroName: "Ana", birthYear: "19-58" }, { scope: "life", genre: "drama" }, { consent: false });
    expect(r.errors).toEqual({ birthYear: "invalidDate" });
    expect(validateStep(movie, "hero", { heroName: "Ana", birthYear: "1958-04" }, { scope: "life", genre: "drama" }, { consent: false }).ok).toBe(true);
  });
  it("refuse une réponse sensible sans consentement explicite", () => {
    const base = { edition: "couple" };
    const r = validateStep(secret, "voice", { tone: "tender", secret: "Un secret" }, base, { consent: false });
    expect(r.errors).toEqual({ secret: "consentRequired" });
    const ok = validateStep(secret, "voice", { tone: "tender", secret: "Un secret" }, base, { consent: true });
    expect(ok.ok).toBe(true);
    expect(ok.hasSensitive).toBe(true);
    // Champ sensible laissé vide : pas de consentement nécessaire
    expect(validateStep(secret, "voice", { tone: "tender" }, base, { consent: false }).ok).toBe(true);
  });
  it("normalise les textes et retire les réponses devenues masquées", () => {
    const r = validateStep(def, "s1", { kind: "b" }, { kind: "a", name: "  Léa  " }, { consent: false });
    expect(r.answers).toEqual({ kind: "b" });
    const r2 = validateStep(def, "s2", { name: "  Léa \t Martin ", note: "" }, { kind: "a" }, { consent: false });
    expect(r2.answers).toEqual({ kind: "a", name: "Léa Martin" });
  });
  it("liste les réponses manquantes pour le récapitulatif", () => {
    expect(missingAnswers(def, { kind: "a" }, { consent: false })).toEqual(["name"]);
    expect(missingAnswers(def, { kind: "a", name: "Léa" }, { consent: false })).toEqual([]);
  });
});

describe("validation des définitions (JSON versionné)", () => {
  it("accepte les trois définitions de départ, sobres (5 à 8 questions par parcours)", () => {
    for (const def of [secret, before, movie]) {
      const lint = lintDefinition(def);
      expect(lint.warnings).toEqual([]);
      expect(lint.min).toBeGreaterThanOrEqual(5);
      expect(lint.max).toBeLessThanOrEqual(8);
    }
  });
  it("couvre les déclinaisons demandées", () => {
    const values = (def: QuestionnaireDefinition) => def.steps[0].questions[0].options!.map((o) => o.value);
    expect(values(secret)).toEqual(["couple", "family", "friends", "growth", "adventure"]);
    expect(values(before)).toEqual(["parents", "grandparents", "couple", "children", "friends"]);
    const movieIds = movie.steps.flatMap((s) => s.questions.map((q) => q.id));
    expect(movieIds).toEqual(expect.arrayContaining(["memory", "turningPoints", "places", "anecdote", "photosLater"]));
  });
  it("refuse une condition qui cite une question placée après, ou inconnue", () => {
    const forward = parseDefinition({ schemaVersion: 1, steps: [
      { id: "s1", title: t("S"), questions: [{ id: "a", type: "text", label: t("A"), showIf: { q: "b", op: "answered" } }, { id: "b", type: "text", label: t("B") }] },
    ] });
    expect(forward.ok).toBe(false);
    if (!forward.ok) expect(forward.errors.join(" ")).toMatch(/placée avant/);
  });
  it("refuse une valeur d'option inexistante dans une condition", () => {
    const r = parseDefinition(mini({ steps: [
      { id: "s1", title: t("One"), questions: [{ id: "kind", type: "single", required: false, sensitive: false, audience: "subject", contributable: false, label: t("Kind"), options: [{ value: "a", label: t("A") }, { value: "b", label: t("B") }] }] },
      { id: "s2", title: t("Two"), showIf: { q: "kind", op: "eq", value: "c" }, questions: [{ id: "x", type: "text", required: false, sensitive: false, audience: "subject", contributable: false, label: t("X") }] },
    ] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/Valeur inconnue/);
  });
  it("refuse doublons, textes sans traduction, options manquantes, identifiants réservés et JSON invalide", () => {
    const dup = mini() as { steps: Array<{ questions: Array<{ id: string }> }> };
    dup.steps[1].questions[1].id = "kind";
    expect(parseDefinition(dup).ok).toBe(false);
    const noFr = parseDefinition({ schemaVersion: 1, steps: [{ id: "s1", title: { en: "Only English" }, questions: [{ id: "a", type: "text", label: t("A") }] }] });
    expect(noFr.ok).toBe(false);
    expect(parseDefinition({ schemaVersion: 1, steps: [{ id: "s1", title: t("S"), questions: [{ id: "a", type: "single", label: t("A") }] }] }).ok).toBe(false);
    expect(parseDefinition({ schemaVersion: 1, steps: [{ id: "review", title: t("S"), questions: [{ id: "a", type: "text", label: t("A") }] }] }).ok).toBe(false);
    const bad = parseDefinition("{ pas du json");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatch(/JSON invalide/);
  });
  it("calcule les étapes visibles dans l'ordre", () => {
    expect(visibleSteps(secret, { edition: "growth" }).map((s) => s.step.id)).toEqual(["edition", "people", "story", "voice"]);
  });
});
