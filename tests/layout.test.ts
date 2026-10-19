import { describe, expect, it } from "vitest";
import { buildActivityPages, buildCoverPage, buildTocPages, buildDiplomaPage, listHeight, type BuildContext } from "@/lib/layout/engine";
import { BUILTIN_TEMPLATES } from "@/lib/layout/themes";
import { estimateTextHeightMm, pageSize } from "@/lib/layout/formats";
import { PageLayoutSchema } from "@/lib/schemas/layout";
import { PILOT_ACTIVITY, DEMO_COVER } from "@/lib/demo/petits-inventeurs";

const ctx: BuildContext = { widthMm: 210, heightMm: 297, theme: BUILTIN_TEMPLATES[0].theme };

function assertInsidePage(pages: ReturnType<typeof buildActivityPages>) {
  for (const p of pages) {
    expect(PageLayoutSchema.safeParse(p.layout).success).toBe(true);
    for (const b of p.layout.blocks) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(p.layout.widthMm + 0.01);
      expect(b.y + b.h).toBeLessThanOrEqual(p.layout.heightMm + 0.01);
    }
  }
}

describe("moteur de mise en page", () => {
  it("produit des pages dont aucun bloc ne dépasse les bords", () => {
    const pages = buildActivityPages({ content: PILOT_ACTIVITY, illustrations: [], ctx, activityNumber: 1, activityId: "a" });
    expect(pages.length).toBeGreaterThanOrEqual(2);
    assertInsidePage(pages);
  });
  it("adapte le nombre de pages à la longueur de l'activité", () => {
    const short = buildActivityPages({ content: { ...PILOT_ACTIVITY, steps: PILOT_ACTIVITY.steps.slice(0, 2) }, illustrations: [], ctx, activityNumber: 1, activityId: "a" });
    const long = buildActivityPages({ content: { ...PILOT_ACTIVITY, steps: [...PILOT_ACTIVITY.steps, ...PILOT_ACTIVITY.steps, ...PILOT_ACTIVITY.steps] }, illustrations: PILOT_ACTIVITY.steps.flatMap((_, i) => [i, i + 5, i + 10]).map((i) => ({ id: `s${i}`, kind: "STEP" as const, stepIndex: i, src: "/x.png", isDemo: false, status: "ACCEPTED" })), ctx, activityNumber: 1, activityId: "a" });
    expect(long.length).toBeGreaterThan(short.length);
    assertInsidePage(long);
  });
  it("ne laisse jamais le titre « Les étapes » orphelin en bas de page", () => {
    const pages = buildActivityPages({ content: PILOT_ACTIVITY, illustrations: [], ctx, activityNumber: 1, activityId: "a" });
    for (const p of pages) {
      const heading = p.layout.blocks.find((b) => b.type === "text" && b.text === "Les étapes");
      if (heading) expect(p.layout.blocks.some((b) => b.type === "step")).toBe(true);
    }
  });
  it("respecte les marges du thème pour les blocs de texte", () => {
    const pages = buildActivityPages({ content: PILOT_ACTIVITY, illustrations: [], ctx, activityNumber: 1, activityId: "a" });
    const m = ctx.theme.marginMm;
    for (const p of pages) for (const b of p.layout.blocks) if (b.type === "text" && b.role !== "title" && b.role !== "label") expect(b.x).toBeGreaterThanOrEqual(m - 0.01);
  });
  it("construit couverture, sommaire multi-pages et diplôme", () => {
    const cover = buildCoverPage(DEMO_COVER, ctx);
    expect(cover.layout.showPageNumber).toBe(false);
    const entries = Array.from({ length: 60 }, (_, i) => ({ number: i + 1, title: `Activité ${i + 1}`, page: i + 3 }));
    expect(buildTocPages(entries, ctx).length).toBe(3);
    expect(buildDiplomaPage("Livre", ctx).templateKey).toBe("diploma");
  });
  it("estime des hauteurs croissantes avec la longueur du texte", () => {
    expect(estimateTextHeightMm("court", 100, 11)).toBeLessThan(estimateTextHeightMm("x".repeat(600), 100, 11));
    expect(listHeight(["a", "b"], 80, 10)).toBeLessThan(listHeight(["a".repeat(120), "b".repeat(120)], 80, 10));
  });
  it("gère les formats de page", () => {
    expect(pageSize("A4_LANDSCAPE")).toEqual({ widthMm: 297, heightMm: 210 });
    expect(pageSize("CUSTOM", 150, 150)).toEqual({ widthMm: 150, heightMm: 150 });
    expect(pageSize("inconnu")).toEqual({ widthMm: 210, heightMm: 297 });
  });
});
