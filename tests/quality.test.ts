import { describe, expect, it } from "vitest";
import { checkActivityContent } from "@/lib/quality/checks";
import { assessSafety } from "@/lib/quality/safety";
import { PILOT_ACTIVITY } from "@/lib/demo/petits-inventeurs";

describe("contrôle qualité", () => {
  it("ne signale ni erreur ni blocage sur la fiche pilote", () => {
    const issues = checkActivityContent(PILOT_ACTIVITY);
    expect(issues.filter((i) => i.severity === "ERROR" || i.severity === "BLOCKER")).toEqual([]);
  });
  it("signale un matériel absent des instructions", () => {
    const content = { ...PILOT_ACTIVITY, materials: [...PILOT_ACTIVITY.materials, { name: "Trombone géant", quantity: "1", optional: false, note: "" }] };
    expect(checkActivityContent(content).some((i) => i.code === "material_unused")).toBe(true);
  });
  it("signale une durée incohérente", () => {
    expect(checkActivityContent({ ...PILOT_ACTIVITY, durationMinutes: 5 }).some((i) => i.code === "duration")).toBe(true);
  });
  it("renvoie des erreurs de schéma pour un contenu invalide", () => {
    const issues = checkActivityContent({ title: "x" });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.code === "schema")).toBe(true);
  });
  it("bloque une activité avec substance dangereuse", () => {
    const content = { ...PILOT_ACTIVITY, steps: PILOT_ACTIVITY.steps.map((s, i) => (i === 0 ? { ...s, instruction: `${s.instruction} Verse un peu de javel dans le bol.` } : s)) };
    const r = assessSafety(content);
    expect(r.blocked).toBe(true);
    expect(checkActivityContent(content).some((i) => i.severity === "BLOCKER")).toBe(true);
  });
  it("bloque les petites pièces pour les 3-5 ans", () => {
    const content = { ...PILOT_ACTIVITY, ageRange: "3-5" as const, materials: [...PILOT_ACTIVITY.materials, { name: "perles", quantity: "10", optional: false, note: "" }], steps: PILOT_ACTIVITY.steps.map((s, i) => (i === 1 ? { ...s, instruction: `${s.instruction} Ajoute des perles.` } : s)) };
    expect(assessSafety(content).blocked).toBe(true);
  });
  it("ne bloque pas la fiche pilote (brochettes = avertissement seulement)", () => {
    const r = assessSafety(PILOT_ACTIVITY);
    expect(r.blocked).toBe(false);
    expect(r.notes.length).toBeGreaterThan(0);
  });
});
