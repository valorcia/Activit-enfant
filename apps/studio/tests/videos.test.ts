import { describe, expect, it } from "vitest";
import { adPropsSchema } from "@malle/video/schema";
import { buildAdProps, clipRatioFor, defaultAdForm, effectivePrice, type ListingLike } from "@/lib/video/props";
import { afterClipAvailable, afterCreate, afterManualRequest, afterProviderState, afterRenderDone, afterRenderFailed, CLIP_TIMEOUT_MS, estimateClipCostUsd, resolveClipProvider } from "@/lib/video/state";

const listing: ListingLike = {
  name: "Le trésor de la Capitaine Coquelicot",
  tagline: "10 énigmes, une carte secrète et un coffre à trouver à la maison",
  priceCents: 990,
  salePriceCents: 790,
  heroBadges: ["PDF A4 immédiat", "Prêt en 20 min"],
  sellingPoints: [{ title: "Prêt en 20 minutes" }, { title: "Deux versions d'énigmes" }, { title: "Rien d'autre à acheter" }, { title: "Quatrième ignorée" }],
  kitContents: [{ title: "cartes énigmes", quantity: 10 }, { title: "Carte au trésor", quantity: 1 }, { title: "Diplômes" }, { title: "Invitations" }, { title: "Guide" }],
};

describe("props de la publicité construites depuis la fiche du livre", () => {
  it("préremplit l'accroche, 3 bénéfices et le CTA", () => {
    const f = defaultAdForm(listing, 12);
    expect(f.hook).toBe(listing.tagline);
    expect(f.bullets).toEqual(["Prêt en 20 minutes", "Deux versions d'énigmes", "Rien d'autre à acheter"]);
    expect(f.cta).toBe("Téléchargez maintenant");
    expect(f.durationSeconds).toBe(12);
  });

  it("se replie sur les badges puis sur des valeurs sûres", () => {
    expect(defaultAdForm({ ...listing, sellingPoints: [] }).bullets).toEqual(["PDF A4 immédiat", "Prêt en 20 min"]);
    expect(defaultAdForm({ name: "Kit", priceCents: 500 }).bullets.length).toBeGreaterThan(0);
  });

  it("applique la promotion avec prix barré", () => {
    expect(effectivePrice(listing)).toEqual({ priceCents: 790, compareAtCents: 990 });
    expect(effectivePrice({ ...listing, salePriceCents: 1200 })).toEqual({ priceCents: 990, compareAtCents: null });
  });

  it("produit des props valides pour Remotion (formats, médias, limites de longueur)", () => {
    const props = buildAdProps(listing, { ...defaultAdForm(listing), hook: "x".repeat(200) }, { hero: "a-hero.png", cover: "a-cover.png", kitImages: ["k0.png", "k1.png"], clip: "a-clip.mp4", music: "m.mp3", musicVolume: 0.4 }, { format: "story", url: "boutique.example" });
    const parsed = adPropsSchema.parse(props);
    expect(parsed.hook.length).toBeLessThanOrEqual(90);
    expect(parsed.kitItems).toHaveLength(4);
    expect(parsed.kitItems[0]).toEqual({ title: "10 cartes énigmes", image: "k0.png" });
    expect(parsed.kitItems[2].image).toBeUndefined();
    expect(parsed.hookClip).toBe("a-clip.mp4");
    expect(parsed.music).toBe("m.mp3");
    expect(parsed.priceCents).toBe(790);
    expect(parsed.compareAtCents).toBe(990);
  });

  it("borne la durée entre 6 et 20 s et adapte le ratio du clip", () => {
    expect(buildAdProps(listing, { ...defaultAdForm(listing), durationSeconds: 40 }, { hero: "h.png" }, { format: "square" }).durationSeconds).toBe(20);
    expect(buildAdProps(listing, { ...defaultAdForm(listing), durationSeconds: 2 }, { hero: "h.png" }, { format: "square" }).durationSeconds).toBe(6);
    expect(clipRatioFor("story")).toBe("portrait");
    expect(clipRatioFor("square")).toBe("square");
    expect(clipRatioFor("landscape")).toBe("landscape");
  });
});

describe("choix du fournisseur de clip", () => {
  it("refuse Runway sans clé et la démo en production", () => {
    expect(resolveClipProvider("runway", { runwayConfigured: false })).toHaveProperty("error");
    expect(resolveClipProvider("runway", { runwayConfigured: true })).toEqual({ provider: "runway" });
    expect(resolveClipProvider("mock", { runwayConfigured: false, allowMock: false })).toHaveProperty("error");
    expect(resolveClipProvider("manual", { runwayConfigured: false })).toEqual({ provider: "manual" });
    expect(resolveClipProvider("none", { runwayConfigured: false })).toEqual({ provider: "none" });
  });

  it("estime le coût uniquement pour Runway", () => {
    expect(estimateClipCostUsd("runway", 5, 0.05)).toBe(0.25);
    expect(estimateClipCostUsd("runway", 10, 0.05)).toBe(0.5);
    expect(estimateClipCostUsd("manual", 10, 0.05)).toBe(0);
  });
});

describe("transitions de statut", () => {
  it("sans clip : directement au montage", () => {
    expect(afterCreate("none")).toMatchObject({ status: "QUEUED", action: "render" });
  });

  it("clip copier-coller : attente du téléversement puis reprise du montage", () => {
    expect(afterCreate("manual")).toMatchObject({ action: "clip" });
    expect(afterManualRequest()).toMatchObject({ status: "WAITING_CLIP", action: "wait_upload" });
    expect(afterClipAvailable()).toMatchObject({ status: "QUEUED", action: "render" });
    expect(afterRenderDone(true)).toMatchObject({ status: "READY", step: "Prête · envoyée à la boutique" });
  });

  it("clip Runway : interrogation, succès, échec et délai dépassé", () => {
    expect(afterProviderState({ status: "running", progress: 0.4 }, 1000)).toMatchObject({ status: "WAITING_CLIP", action: "poll", step: expect.stringContaining("40 %") });
    expect(afterProviderState({ status: "succeeded" }, 1000)).toMatchObject({ action: "render" });
    expect(afterProviderState({ status: "failed", error: "quota" }, 1000)).toMatchObject({ status: "FAILED", error: "quota" });
    expect(afterProviderState({ status: "pending" }, CLIP_TIMEOUT_MS + 1)).toMatchObject({ status: "FAILED", action: "none" });
    expect(afterRenderFailed("boom")).toMatchObject({ status: "FAILED", error: "boom" });
  });
});
