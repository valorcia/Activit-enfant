import { describe, expect, it } from "vitest";
import { buildListingFromBook, parseAgeRange, stableSlug, type BookForListing } from "@/lib/shop/publish";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/schemas/settings";

const book = {
  id: "cmw7pyzet00047d8q2oxobjn1", title: "Les Petits Inventeurs", subtitle: "10 inventions extraordinaires", collection: null, bookType: "inventions", ageRange: "6-9",
  targetCount: 10, artStyle: "aquarelle", pageFormat: "A4_PORTRAIT", customWidthMm: null, customHeightMm: null, language: "fr", status: "READY", brief: "Un livre pour bricoler.",
  cover: { introduction: "Bienvenue dans l'atelier !" }, theme: null, version: 1, createdAt: new Date(), updatedAt: new Date(),
  shopProductId: null, shopProductSlug: null, shopPublishedAt: null, shopLastSyncAt: null, shopSyncError: null, shopListing: null,
  activities: [
    { activity: { title: "Voiture à ballon", concept: { summary: "Construis une voiture propulsée par un ballon. Elle file !", keyMaterials: ["ballon", "bouchons"] }, currentVersion: null, durationMinutes: 40, difficulty: 2, category: "inventions" } },
    { activity: { title: "Périscope", concept: null, currentVersion: { content: { subtitle: "Regarde par-dessus les murs" } }, durationMinutes: 60, difficulty: 3, category: "inventions" } },
  ],
  exports: [{ id: "e1", kind: "BOOK_DIGITAL", status: "COMPLETED", pageCount: 32, assetId: "a1", createdAt: new Date() }],
} as unknown as BookForListing;

describe("publication boutique", () => {
  it("convertit la tranche d'âge", () => {
    expect(parseAgeRange("6-9")).toEqual({ ageMin: 6, ageMax: 9 });
    expect(parseAgeRange("3-5")).toEqual({ ageMin: 3, ageMax: 5 });
    expect(parseAgeRange("tous")).toEqual({});
  });
  it("produit un slug stable lié au livre", () => {
    expect(stableSlug(book)).toBe("les-petits-inventeurs-xobjn1");
    expect(stableSlug(book)).toBe(stableSlug({ ...book, title: "Les Petits Inventeurs" }));
  });
  it("dérive une fiche complète depuis le livre", () => {
    const l = buildListingFromBook(book, DEFAULT_SHOP_SETTINGS);
    expect(l.name).toBe("Les Petits Inventeurs");
    expect(l.tagline).toBe("10 inventions extraordinaires");
    expect(l.ageMin).toBe(6); expect(l.ageMax).toBe(9);
    expect(l.pageCount).toBe(32);
    expect(l.template).toBe("ACTIVITY");
    expect(l.priceCents).toBe(DEFAULT_SHOP_SETTINGS.defaultPriceCents);
    expect(l.kitContents).toHaveLength(2);
    expect(l.kitContents[0]).toMatchObject({ title: "Voiture à ballon", description: "Construis une voiture propulsée par un ballon." });
    expect(l.kitContents[1].description).toBe("Regarde par-dessus les murs");
    expect(l.materials).toEqual(["ballon", "bouchons"]);
    expect(l.longDescription).toContain("## Au sommaire");
    expect(l.durationMinutes).toBe(50);
    expect(l.seoTitle.length).toBeLessThanOrEqual(70);
  });
  it("les surcharges de la fiche l'emportent sur les valeurs dérivées", () => {
    const l = buildListingFromBook({ ...book, shopListing: { name: "Atelier des inventeurs", priceCents: 1290, template: "STORY", categorySlug: "activites-educatives", faq: [{ question: "Q", answer: "R" }] } } as BookForListing, DEFAULT_SHOP_SETTINGS);
    expect(l.name).toBe("Atelier des inventeurs");
    expect(l.priceCents).toBe(1290);
    expect(l.template).toBe("STORY");
    expect(l.categorySlug).toBe("activites-educatives");
    expect(l.faq).toEqual([{ question: "Q", answer: "R" }]);
    expect(l.slug).toBe("les-petits-inventeurs-xobjn1");
  });
});
