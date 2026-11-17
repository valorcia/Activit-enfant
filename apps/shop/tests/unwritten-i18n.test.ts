import { describe, expect, it } from "vitest";
import { en } from "@/lib/unwritten/i18n/en";
import { fr } from "@/lib/unwritten/i18n/fr";
import { formatMoney, href, hreflangAlternates, negotiateLocale, parsePublicPath, switchLocale } from "@/lib/unwritten/i18n";
import { routeUnwritten } from "@/lib/unwritten/proxy-route";
import { personalizedPrice } from "@/lib/unwritten/pricing";
import { productContentSchema, STARTER_PRODUCTS } from "@/lib/unwritten/catalog-content";
import { sanitizeRef } from "@/lib/unwritten/constants";

/** i18n de la vitrine UNWRITTEN : routes localisées, négociation, hreflang, formats de prix. */

function keys(obj: unknown, prefix = ""): string[] {
  if (Array.isArray(obj)) return [`${prefix}[${obj.length}]`, ...obj.flatMap((x, i) => keys(x, `${prefix}[${i}]`))];
  if (obj && typeof obj === "object") return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

describe("dictionnaires", () => {
  it("ont exactement la même structure en anglais et en français", () => {
    expect(keys(fr)).toEqual(keys(en));
  });
  it("respectent la typographie française (espace fine avant ? et :)", () => {
    expect(fr.questionnaire.modeTitle).toBe("Qui va répondre ?");
    const all = JSON.stringify(fr);
    expect(all).not.toMatch(/[^  ]\?(?!\w)/); // aucun « ? » collé
    expect(all).not.toMatch(/ [?:!;]/); // pas d'espace normale avant la ponctuation haute
  });
  it("décrivent les produits de départ dans les deux langues", () => {
    for (const p of STARTER_PRODUCTS) expect(productContentSchema.safeParse(p.content).success).toBe(true);
  });
});

describe("URLs localisées", () => {
  it("construit les chemins publics par langue", () => {
    expect(href("en")).toBe("/en");
    expect(href("en", "books", "the-secret-book")).toBe("/en/books/the-secret-book");
    expect(href("fr", "books", "the-secret-book")).toBe("/fr/livres/the-secret-book");
    expect(href("fr", "create", "x", "review")).toBe("/fr/creer/x/recapitulatif");
  });
  it("retrouve le chemin interne et change de langue sur la même page", () => {
    expect(parsePublicPath("/fr/livres/x")).toEqual({ locale: "fr", internal: "/books/x" });
    expect(parsePublicPath("/en")).toEqual({ locale: "en", internal: "" });
    expect(parsePublicPath("/de/books").unknownLocale).toBe("de");
    expect(switchLocale("/en/create/x/review", "fr")).toBe("/fr/creer/x/recapitulatif");
    expect(switchLocale("/fr/cadeau/abc", "en")).toBe("/en/gift/abc");
  });
  it("produit les alternatives hreflang des seules langues ouvertes, avec x-default", () => {
    expect(hreflangAlternates("https://u.test", ["en", "fr"], "en", "books", "b")).toEqual({
      en: "https://u.test/en/books/b", fr: "https://u.test/fr/livres/b", "x-default": "https://u.test/en/books/b",
    });
    expect(hreflangAlternates("https://u.test/", ["fr"], "en")).toEqual({ fr: "https://u.test/fr", "x-default": "https://u.test/fr" });
  });
});

describe("négociation de la langue et routage du proxy", () => {
  it("lit Accept-Language (q-valeurs, sous-étiquette) parmi les langues ouvertes", () => {
    expect(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.8", ["en", "fr"], "en")).toBe("fr");
    expect(negotiateLocale("de-DE,en-US;q=0.7,fr;q=0.9", ["en", "fr"], "en")).toBe("fr");
    expect(negotiateLocale("de-DE", ["en", "fr"], "en")).toBe("en");
    expect(negotiateLocale("fr", ["en"], "en")).toBe("en"); // français fermé
    expect(negotiateLocale(null, ["en", "fr"], "fr")).toBe("fr");
  });
  const site = { locales: ["en", "fr"], defaultLocale: "en" };
  it("redirige la racine vers la langue mémorisée, sinon négociée", () => {
    expect(routeUnwritten({ ...site, pathname: "/", search: "?ref=abc", acceptLanguage: "fr" })).toEqual({ type: "redirect", location: "/fr?ref=abc" });
    expect(routeUnwritten({ ...site, pathname: "/", search: "", acceptLanguage: "fr", cookieLocale: "en" })).toEqual({ type: "redirect", location: "/en" });
    expect(routeUnwritten({ ...site, pathname: "/books/x", search: "" })).toEqual({ type: "redirect", location: "/en/books/x" });
  });
  it("réécrit les URLs localisées vers l'arbre interne et mémorise la langue", () => {
    expect(routeUnwritten({ ...site, pathname: "/fr/livres/the-secret-book", search: "", cookieLocale: "en" })).toEqual({ type: "rewrite", pathname: "/u/fr/books/the-secret-book", locale: "fr", rememberLocale: true });
    expect(routeUnwritten({ ...site, pathname: "/en", search: "", cookieLocale: "en" })).toEqual({ type: "rewrite", pathname: "/u/en", locale: "en", rememberLocale: false });
  });
  it("redirige une langue fermée vers la langue par défaut", () => {
    expect(routeUnwritten({ locales: ["en"], defaultLocale: "en", pathname: "/fr/livres/x", search: "" })).toEqual({ type: "redirect", location: "/en/books/x" });
  });
  it("assainit le paramètre ref", () => {
    expect(sanitizeRef("amie-42")).toBe("amie-42");
    expect(sanitizeRef("<script>")).toBeNull();
    expect(sanitizeRef("")).toBeNull();
  });
});

describe("prix", () => {
  it("formate via Intl dans la devise de la marque", () => {
    expect(formatMoney(1990, "EUR", "fr")).toBe("19,90 €");
    expect(formatMoney(1990, "EUR", "en")).toBe("€19.90");
    expect(formatMoney(3990, "USD", "en")).toBe("US$39.90");
  });
  it("utilise le prix fixé par devise, sans conversion", () => {
    const product = { priceCents: 1990, currency: "EUR" };
    expect(personalizedPrice(product, { EUR: 1990, USD: 2200 }, "USD")).toBe(2200);
    expect(personalizedPrice(product, {}, "EUR")).toBe(1990);
    expect(personalizedPrice(product, {}, "GBP")).toBeNull();
  });
});
