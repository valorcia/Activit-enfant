import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { authenticateApiKey, checkRateLimit, extractBearer, resetRateLimits } from "@/lib/api/auth";
import { sha256 } from "@/lib/tokens";
import { db, resetDb } from "./helpers/db";

beforeEach(async () => { await resetDb(); resetRateLimits(); });
afterAll(async () => { await db.$disconnect(); });

function req(auth?: string) {
  return new Request("http://localhost/api/v1/products", { headers: auth ? { authorization: auth } : {} });
}

describe("authenticateApiKey", () => {
  it("extrait le jeton Bearer", () => {
    expect(extractBearer(req("Bearer abc"))).toBe("abc");
    expect(extractBearer(req("bearer abc"))).toBe("abc");
    expect(extractBearer(req("Basic abc"))).toBeNull();
    expect(extractBearer(req())).toBeNull();
  });

  it("accepte une clé valide et met à jour lastUsedAt", async () => {
    const secret = "cc_valide";
    const key = await db.apiKey.create({ data: { name: "Test", prefix: secret.slice(0, 8), keyHash: sha256(secret), scopes: ["products:write"] } });
    const res = await authenticateApiKey(req(`Bearer ${secret}`), "products:write", db);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.key.id).toBe(key.id);
    await new Promise((r) => setTimeout(r, 50));
    expect((await db.apiKey.findUniqueOrThrow({ where: { id: key.id } })).lastUsedAt).not.toBeNull();
  });

  it("refuse une clé absente, inconnue ou révoquée (401)", async () => {
    expect(await authenticateApiKey(req(), undefined, db)).toMatchObject({ ok: false, status: 401 });
    expect(await authenticateApiKey(req("Bearer cc_inconnue"), undefined, db)).toMatchObject({ ok: false, status: 401 });
    await db.apiKey.create({ data: { name: "Révoquée", prefix: "cc_revoq", keyHash: sha256("cc_revoquee"), scopes: ["products:write"], revokedAt: new Date() } });
    expect(await authenticateApiKey(req("Bearer cc_revoquee"), undefined, db)).toMatchObject({ ok: false, status: 401 });
  });

  it("refuse un scope manquant (403)", async () => {
    await db.apiKey.create({ data: { name: "Lecture", prefix: "cc_lectu", keyHash: sha256("cc_lecture"), scopes: ["products:read"] } });
    expect(await authenticateApiKey(req("Bearer cc_lecture"), "products:publish", db)).toMatchObject({ ok: false, status: 403 });
    expect((await authenticateApiKey(req("Bearer cc_lecture"), "products:read", db)).ok).toBe(true);
  });

  it("limite le débit à 60 requêtes par minute", () => {
    for (let i = 0; i < 60; i++) expect(checkRateLimit("k", 0)).toBe(true);
    expect(checkRateLimit("k", 0)).toBe(false);
    expect(checkRateLimit("k", 61_000)).toBe(true);
  });
});
