import { afterEach, describe, expect, it } from "vitest";
import { studioProductUrl, studioUrl } from "@/lib/studio-link";
import { env } from "@/lib/env";

const original = { studio: process.env.STUDIO_URL, app: env.appUrl };
afterEach(() => {
  if (original.studio === undefined) delete process.env.STUDIO_URL;
  else process.env.STUDIO_URL = original.studio;
  (env as { appUrl: string }).appUrl = original.app;
});

describe("lien vers le studio", () => {
  it("utilise STUDIO_URL quand elle est définie", () => {
    process.env.STUDIO_URL = "https://mon-studio.exemple.fr/";
    expect(studioUrl()).toBe("https://mon-studio.exemple.fr");
    expect(studioProductUrl("p1")).toBe("https://mon-studio.exemple.fr/books/by-shop/p1");
  });

  it("déduit studio.<domaine> depuis l'adresse de la boutique", () => {
    delete process.env.STUDIO_URL;
    (env as { appUrl: string }).appUrl = "https://www.lamalleajeux.eu";
    expect(studioUrl()).toBe("https://studio.lamalleajeux.eu");
  });

  it("aucun lien en local ou sur une adresse vercel.app", () => {
    delete process.env.STUDIO_URL;
    (env as { appUrl: string }).appUrl = "http://localhost:3000";
    expect(studioUrl()).toBe("");
    (env as { appUrl: string }).appUrl = "https://activite-enfant-shop.vercel.app";
    expect(studioProductUrl("p1")).toBe("");
  });
});
