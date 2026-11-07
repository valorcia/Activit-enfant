import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/ai/structured";
import { MockTextProvider } from "@/lib/ai/text/mock";
import { MockImageProvider } from "@/lib/ai/image/mock";
import { ActivityContentSchema, BookOutlineSchema, VisualReferenceSheetSchema } from "@/lib/schemas/activity";
import { estimateBookCost } from "@/lib/queue/estimate";
import { DEFAULT_AI_SETTINGS } from "@/lib/schemas/settings";
import { textCost, imageCost } from "@/lib/ai/pricing";

describe("adaptateurs IA", () => {
  it("extrait du JSON entouré de texte ou de balises", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Voici : {"a":{"b":2}} merci')).toEqual({ a: { b: 2 } });
    expect(extractJson("pas de json")).toBeNull();
  });
  it("le fournisseur de démonstration produit un sommaire valide", async () => {
    const p = new MockTextProvider();
    const r = await p.complete({ system: "", prompt: '<<purpose:outline>>\n<<context>>{"count":"12","category":"sciences","title":"Test"}<</context>>', model: "mock", json: true });
    const parsed = BookOutlineSchema.safeParse(JSON.parse(r.text));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.activities.length).toBe(12);
  });
  it("le fournisseur de démonstration produit une fiche et une référence valides", async () => {
    const p = new MockTextProvider();
    const a = await p.complete({ system: "", prompt: '<<purpose:activity>>\n<<context>>{"title":"Le volcan","summary":"Un volcan qui crache de la mousse rouge.","finalObject":"volcan","mainConcept":"réaction acide-base","keyMaterials":"bicarbonate, vinaigre","ageRange":"6-9"}<</context>>', model: "mock", json: true });
    expect(ActivityContentSchema.safeParse(JSON.parse(a.text)).success).toBe(true);
    const v = await p.complete({ system: "", prompt: '<<purpose:visual_reference>>\n<<context>>{"title":"Le volcan","stepCount":"4"}<</context>>', model: "mock", json: true });
    expect(VisualReferenceSheetSchema.safeParse(JSON.parse(v.text)).success).toBe(true);
  });
  it("le fournisseur d'images de démonstration produit un PNG marqué isDemo", async () => {
    const p = new MockImageProvider();
    const r = await p.generate({ prompt: "Une voiture en carton", size: "1024x1024", quality: "low", model: "mock", label: "Test" });
    expect(r.isDemo).toBe(true);
    expect(r.mime).toBe("image/png");
    expect(r.data.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(r.width).toBe(1024);
  });
  it("estime les coûts et compare au budget", () => {
    expect(textCost("claude-opus-5-5", 1_000_000, 0)).toBe(4);
    expect(imageCost("gpt-image-1", "medium", "1024x1024")).toBeCloseTo(0.042);
    const mock = estimateBookCost(DEFAULT_AI_SETTINGS, { activities: 10, includeCover: true });
    expect(mock.total).toBe(0);
    const real = estimateBookCost({ ...DEFAULT_AI_SETTINGS, textProvider: "anthropic", imageProvider: "openai", maxBudgetPerBookUsd: 1 }, { activities: 30, includeCover: true });
    expect(real.total).toBeGreaterThan(1);
    expect(real.overBudget).toBe(true);
    expect(real.imagesCount).toBe(30 * (1 + 5) + 2);
  });
});
