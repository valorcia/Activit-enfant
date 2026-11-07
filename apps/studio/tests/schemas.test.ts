import { describe, expect, it } from "vitest";
import { ActivityContentSchema, BookOutlineSchema, VisualReferenceSheetSchema, CoverDataSchema } from "@/lib/schemas/activity";
import { PageLayoutSchema } from "@/lib/schemas/layout";
import { PILOT_ACTIVITY, PILOT_VISUAL_REFERENCE, DEMO_COVER, DEMO_CONCEPTS } from "@/lib/demo/petits-inventeurs";

describe("schémas", () => {
  it("valide la fiche pilote", () => {
    expect(ActivityContentSchema.safeParse(PILOT_ACTIVITY).success).toBe(true);
  });
  it("rejette une fiche sans étapes suffisantes", () => {
    const r = ActivityContentSchema.safeParse({ ...PILOT_ACTIVITY, steps: [PILOT_ACTIVITY.steps[0]] });
    expect(r.success).toBe(false);
  });
  it("valide la fiche de référence visuelle et la couverture", () => {
    expect(VisualReferenceSheetSchema.safeParse(PILOT_VISUAL_REFERENCE).success).toBe(true);
    expect(CoverDataSchema.safeParse(DEMO_COVER).success).toBe(true);
  });
  it("valide un sommaire de 10 concepts", () => {
    const r = BookOutlineSchema.safeParse({ title: "Les Petits Inventeurs", subtitle: "", introduction: "Bienvenue dans l'atelier des petits inventeurs, prépare ton matériel !", activities: DEMO_CONCEPTS });
    expect(r.success).toBe(true);
    expect(r.success && r.data.activities.length).toBe(10);
  });
  it("valide une mise en page avec blocs discriminés", () => {
    const r = PageLayoutSchema.safeParse({ widthMm: 210, heightMm: 297, blocks: [{ id: "a", type: "text", text: "x", x: 0, y: 0, w: 10, h: 10 }, { id: "b", type: "image", x: 0, y: 0, w: 10, h: 10 }] });
    expect(r.success).toBe(true);
    expect(PageLayoutSchema.safeParse({ widthMm: 210, heightMm: 297, blocks: [{ id: "a", type: "unknown" }] }).success).toBe(false);
  });
});
