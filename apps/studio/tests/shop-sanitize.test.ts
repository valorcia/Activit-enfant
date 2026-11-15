import { describe, expect, it } from "vitest";
import { describeValidationDetails, sanitizeListing } from "@/lib/shop/sanitize";

describe("fiche produit mise aux limites de la boutique", () => {
  it("raccourcit et nettoie les champs trop longs écrits par l'IA", () => {
    const l = sanitizeListing({
      name: "Les 24 bêtises de Fripouille",
      slug: "Les 24 Bêtises !",
      seoTitle: "x".repeat(90),
      keywords: ["lutin", "LUTIN", "", "y".repeat(120)],
      faq: [{ question: "q".repeat(250), answer: "Oui." }, { question: "", answer: "vide" }],
      kitContents: [{ title: "t".repeat(140), description: "d".repeat(500), quantity: "3" }],
      difficulty: 7,
      ageMin: 10,
      ageMax: 3,
      priceCents: 490,
      salePriceCents: 590,
    });
    expect(l.slug).toBe("les-24-b-tises");
    expect((l.seoTitle as string).length).toBeLessThanOrEqual(70);
    expect(l.keywords).toHaveLength(2);
    expect((l.keywords as string[])[1].length).toBeLessThanOrEqual(80);
    expect(l.faq).toHaveLength(1);
    expect((l.faq as Array<{ question: string }>)[0].question.length).toBeLessThanOrEqual(200);
    const item = (l.kitContents as unknown as Array<{ title: string; description: string; quantity: number }>)[0];
    expect(item.title.length).toBeLessThanOrEqual(120);
    expect(item.description.length).toBeLessThanOrEqual(400);
    expect(item.quantity).toBe(3);
    expect(l.difficulty).toBe(5);
    expect([l.ageMin, l.ageMax]).toEqual([3, 10]);
    expect(l.salePriceCents).toBeUndefined();
  });

  it("nomme les champs refusés dans le message d'erreur", () => {
    expect(describeValidationDetails([{ path: "faq.0.question", message: "Too big" }])).toBe(" (faq.0.question : Too big)");
    expect(describeValidationDetails(undefined)).toBe("");
  });
});
