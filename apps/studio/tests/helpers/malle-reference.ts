/**
 * Référence de non-régression La Malle à Jeux : construit, avec les gabarits existants
 * (kits et moteur des livres d'activités), un jeu de pages représentatif dans les formats
 * historiques. Les identifiants aléatoires des blocs sont normalisés pour comparer
 * deux constructions octet pour octet.
 *
 * Le fichier `tests/fixtures/malle-pages.golden.json` a été produit avec ce module AVANT
 * l'ajout du moteur éditorial UNWRITTEN (commande : `npx tsx tests/helpers/malle-reference.ts --write-pages`).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { BUILTIN_TEMPLATES } from "@/lib/layout/themes";
import { buildActivityPages, buildBackCoverPage, buildConclusionPage, buildCoverPage, buildDiplomaPage, buildIntroPage, buildTocPages, type BuildContext, type BuiltPage } from "@/lib/layout/engine";
import { buildPranksPages, buildTreasureHuntPages } from "@/lib/kits/pages";
import { buildGuideBookPages, buildRecipesBookPages, buildScienceBookPages } from "@/lib/kits/pages-universes";
import { buildColoringPages } from "@/lib/kits/pages-coloring";
import { mockColoring, mockGuide, mockPranksKit, mockRecipes, mockScience, mockTreasureHunt } from "@/lib/kits/mock";
import { ColoringSchema, GuideSchema, PranksKitSchema, RecipesSchema, ScienceSchema, TreasureHuntSchema } from "@/lib/kits/schemas";
import { coloringOptionsOf } from "@/lib/kits/generate";
import { PILOT_ACTIVITY, DEMO_COVER } from "@/lib/demo/petits-inventeurs";

function normalize(pages: BuiltPage[]) {
  return pages.map((p) => ({ ...p, layout: { ...p.layout, blocks: p.layout.blocks.map((b, i) => ({ ...b, id: `#${i}` })) } }));
}

export function buildMalleReferencePages() {
  const out: Record<string, unknown> = {};
  const malle = BUILTIN_TEMPLATES.find((t) => t.key === "malle")!.theme;
  const formats: [string, number, number][] = [["A4_PORTRAIT", 210, 297], ["SQUARE", 210, 210]];
  for (const [key, widthMm, heightMm] of formats) {
    const ctx: BuildContext = { widthMm, heightMm, theme: malle };
    const img = { src: "/api/assets/demo", isDemo: false, illustrationId: "ill" };
    out[`${key}/treasure`] = normalize(buildTreasureHuntPages(ctx, TreasureHuntSchema.parse(mockTreasureHunt({ count: 10 })), { lettre: img, carte: img }));
    out[`${key}/pranks`] = normalize(buildPranksPages(ctx, PranksKitSchema.parse(mockPranksKit({ count: 6 })), {}));
    out[`${key}/guide`] = normalize(buildGuideBookPages(ctx, GuideSchema.parse(mockGuide({ count: 4 })), {}));
    out[`${key}/recipes`] = normalize(buildRecipesBookPages(ctx, RecipesSchema.parse(mockRecipes({ count: 3 })), {}));
    out[`${key}/science`] = normalize(buildScienceBookPages(ctx, ScienceSchema.parse(mockScience({ count: 3 })), {}));
    out[`${key}/coloring`] = normalize(buildColoringPages(ctx, ColoringSchema.parse(mockColoring({ count: 4 })), {}, coloringOptionsOf(null)));
    const atelier: BuildContext = { widthMm, heightMm, theme: BUILTIN_TEMPLATES[0].theme };
    out[`${key}/activity`] = normalize([
      buildCoverPage(DEMO_COVER, atelier),
      buildIntroPage("Petits inventeurs", "Bienvenue dans l'atelier.", atelier),
      ...buildTocPages([{ number: 1, title: "Activité", page: 3 }], atelier),
      ...buildActivityPages({ content: PILOT_ACTIVITY, illustrations: [], ctx: atelier, activityNumber: 1, activityId: "a" }),
      buildConclusionPage(atelier, 1),
      buildDiplomaPage("Petits inventeurs", atelier),
      buildBackCoverPage(DEMO_COVER, atelier),
    ]);
  }
  return out;
}

if (process.argv.includes("--write-pages")) {
  const file = path.resolve(__dirname, "../fixtures/malle-pages.golden.json");
  writeFileSync(file, JSON.stringify(buildMalleReferencePages(), null, 1));
  console.log(`Référence écrite : ${file}`);
}
