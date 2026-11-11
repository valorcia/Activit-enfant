import { describe, expect, it } from "vitest";
import { clip } from "@/lib/kits/generate";
import { CoverDataSchema } from "@/lib/schemas/activity";

describe("clip", () => {
  it("laisse un texte court intact", () => { expect(clip("  Bonjour  ", 20)).toBe("Bonjour"); });
  it("coupe sur une fin de mot et respecte la limite", () => {
    const out = clip("Illustration jeunesse à l'aquarelle avec deux bébés dinosaures dans une vallée", 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });
  it("une description de couverture de 1 500 caractères est acceptée", () => {
    expect(CoverDataSchema.parse({ title: "T", illustrationBrief: "x".repeat(1500) }).illustrationBrief).toHaveLength(1500);
  });
});
