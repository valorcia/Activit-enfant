import { describe, expect, it } from "vitest";
import { contentPromptFor, readabilityRules } from "@/lib/kits/prompts";
import { KIT_TYPES } from "@/lib/kits/types";
import { KitCustomizationSchema, TreasureHuntSchema } from "@/lib/kits/schemas";
import { quickStartOf } from "@/lib/kits/layout";
import { buildQuickStartPage } from "@/lib/kits/pages";

const c = KitCustomizationSchema.parse({});
const def = (format: string) => Object.values(KIT_TYPES).find((d) => d.format === format)!;
const ctx = { widthMm: 210, heightMm: 297, theme: { marginMm: 15, colorPrimary: "#1e3a8a", colorSecondary: "#f97316" } } as never;

describe("e-books plus simples et lisibles", () => {
  it("impose des textes courts et la page « Comment ça marche ? » dans les prompts", () => {
    const p = contentPromptFor("treasure_hunt", { def: def("treasure_hunt"), title: "Dino", ageRange: "5-8", count: 6, c });
    expect(p).toContain("SIMPLICITÉ ET LISIBILITÉ");
    expect(p).toContain('"demarrage_rapide"');
    expect(p).toContain("70 à 110 mots");
    expect(p).not.toContain("120 à 160 mots");
  });

  it("pas de page de démarrage pour un cahier de coloriage", () => {
    const p = contentPromptFor("coloring", { def: def("coloring"), title: "Dino", ageRange: "3-5", count: 10, c });
    expect(p).not.toContain('"demarrage_rapide"');
    expect(p).toContain("SIMPLICITÉ ET LISIBILITÉ");
  });

  it("règles adaptées aux adultes sans consignes pour enfants", () => {
    expect(readabilityRules("18-99")).not.toContain("Textes lus par l'enfant");
  });

  it("le contenu accepte le démarrage rapide et les anciens contenus restent valides", () => {
    const base = { titre: "Dino", lettre: "Bonjour les explorateurs, voici votre mission.", enigmes: [{ numero: 1, texte: "Où est le froid ?" }] };
    expect(TreasureHuntSchema.safeParse(base).success).toBe(true);
    expect(TreasureHuntSchema.safeParse({ ...base, demarrage_rapide: { etapes: ["Imprime", "Cache", "Joue"] } }).success).toBe(true);
  });

  it("déduit un démarrage rapide des anciens kits et construit la page", () => {
    const q = quickStartOf("treasure_hunt", { guide: { materiel: ["Scotch", "Ciseaux"], preparation: ["Imprime les cartes", "Cache-les", "Lis la lettre", "Joue"] } });
    expect(q.etapes).toEqual(["Imprime les cartes", "Cache-les", "Lis la lettre"]);
    const page = buildQuickStartPage(ctx, { ...q, age: "5–8 ans", duree: "45 min", astuce: "Prépare tout la veille." });
    expect(page?.templateKey).toBe("kit_quickstart");
    const texts = page!.layout.blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text);
    expect(texts).toContain("Comment ça marche ?");
    expect(texts.some((t) => t.includes("☐  Scotch"))).toBe(true);
    expect(texts).toContain("Imprime les cartes");
    for (const b of page!.layout.blocks) expect(b.y + b.h).toBeLessThanOrEqual(297);
  });

  it("aucune page si le contenu ne donne rien d'utile", () => {
    expect(buildQuickStartPage(ctx, {})).toBeNull();
  });
});
