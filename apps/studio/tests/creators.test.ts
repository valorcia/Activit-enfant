import { afterEach, describe, expect, it, vi } from "vitest";
import { briefFromSubmission, creatorNotes } from "@/lib/creators/brief";
import { KitCustomizationSchema, KitPlanSchema } from "@/lib/kits/schemas";
import { ShopClient, type ShopCreatorSubmission } from "@/lib/shop/client";
import { creatorOf } from "@/lib/shop/publish";
import { extractJson } from "@/lib/ai/structured";

const sub: ShopCreatorSubmission = {
  id: "sub_1", title: "Le hérisson dans sa bulle", status: "ACCEPTED", ageMin: 4, ageMax: 8, durationMinutes: 45,
  materials: ["un bocal en verre", "de la mousse", "des pommes de pin"], steps: ["Ramasser la mousse", "Former le hérisson", "Fermer le bocal"],
  tips: "Humidifier la mousse", safetyNotes: "Verre : avec un adulte", contribution: "IDEA", exclusive: false, rateBp: 2500,
  studioBookId: null, productId: null, previewUrl: null, submittedAt: null, moderatedAt: null,
  creator: { id: "c1", publicName: "Marie", slug: "marie", bio: null }, credit: "Une idée de Marie",
  photos: [{ url: "https://boutique.example/api/storage/local?key=private%2Fcreators%2Fc1%2Fa.jpg&sig=x", width: 2400, height: 1800 }],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("brief depuis l'idée d'une créatrice", () => {
  it("produit un plan de kit importé tel quel, fidèle à l'idée, avec le crédit", () => {
    const brief = briefFromSubmission(sub, { siteSlug: "la-malle-a-jeux", priceCents: 390 });
    const plan = KitPlanSchema.parse(extractJson(brief));
    expect(plan).toMatchObject({ kitType: "fiches-sciences", title: "Le hérisson dans sa bulle", subtitle: "Une idée de Marie", ageRange: "4-8", count: 1, priceCents: 390, siteSlug: "la-malle-a-jeux" });
    expect(plan.notes).toContain("Une idée de Marie");
    expect(plan.notes).toContain("2. Former le hérisson");
    expect(plan.notes).toContain("un bocal en verre ; de la mousse");
    expect(plan.notes).toContain("Verre : avec un adulte");
    expect(plan.notes).not.toContain("sig=");
  });

  it("borne les notes (4 000 caractères) et l'âge manquant", () => {
    const long = { ...sub, ageMin: null, ageMax: null, steps: Array.from({ length: 30 }, (_, i) => `Étape ${i} `.repeat(30)) };
    expect(creatorNotes(long).length).toBeLessThanOrEqual(3900);
    const plan = KitPlanSchema.parse(JSON.parse(briefFromSubmission(long)));
    expect(plan.ageRange).toMatch(/^\d+-\d+$/);
  });

  it("le crédit est conservé dans la personnalisation du livre", () => {
    const c = KitCustomizationSchema.parse({ creator: { submissionId: "sub_1", name: "Marie", credit: "Une idée de Marie" } });
    expect(c.creator?.submissionId).toBe("sub_1");
    expect(creatorOf({ customization: c })).toMatchObject({ submissionId: "sub_1", credit: "Une idée de Marie" });
    expect(creatorOf({ customization: {} })).toBeNull();
  });
});

describe("client boutique : espace créatrices", () => {
  it("appelle les routes de l'API v1 avec la clé", async () => {
    const calls: Array<{ url: string; method: string; body?: string; auth: string | null }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body as string | undefined, auth: new Headers(init.headers).get("authorization") });
      return new Response(JSON.stringify({ data: url.endsWith("submissions?status=ACCEPTED") ? [sub] : sub }), { status: 200 });
    }));
    const client = new ShopClient({ baseUrl: "https://boutique.example/", apiKey: "cc_test" });
    expect(await client.creatorSubmissions()).toHaveLength(1);
    await client.startCreatorProduction("sub_1", "book_1");
    await client.sendCreatorPreview("sub_1", "https://studio.example/preview/t");
    await client.linkCreatorSubmission("sub_1", "prod_1");
    expect(calls.map((c) => `${c.method} ${c.url.replace("https://boutique.example/api/v1", "")}`)).toEqual([
      "GET /creators/submissions?status=ACCEPTED",
      "POST /creators/submissions/sub_1/production",
      "POST /creators/submissions/sub_1/preview",
      "POST /creators/submissions/sub_1/link",
    ]);
    expect(calls.every((c) => c.auth === "Bearer cc_test")).toBe(true);
    expect(JSON.parse(calls[2].body!)).toEqual({ previewUrl: "https://studio.example/preview/t" });
  });

  it("renvoie null pour une proposition inconnue (404)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Proposition introuvable" }), { status: 404 })));
    expect(await new ShopClient({ baseUrl: "https://b.example", apiKey: "k" }).creatorSubmission("x")).toBeNull();
  });
});
