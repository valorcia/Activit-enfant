import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));

// Dossier de stockage isolé, défini avant le chargement des modules (imports hissés)
const storageDir = vi.hoisted(() => {
  const dir = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "shop-videos-"));
  process.env.STORAGE_LOCAL_DIR = dir;
  return dir as string;
});

import { sha256 } from "@/lib/tokens";
import { resetRateLimits } from "@/lib/api/auth";
import { parseVideoAlt, videoAlt } from "@/lib/api/video";
import { db, resetDb, createProductFixture } from "./helpers/db";

let GET: typeof import("@/app/api/v1/products/[id]/videos/route").GET;
let POST: typeof import("@/app/api/v1/products/[id]/videos/route").POST;

beforeAll(async () => {
  ({ GET, POST } = await import("@/app/api/v1/products/[id]/videos/route"));
});
beforeEach(async () => { await resetDb(); resetRateLimits(); });
afterAll(async () => { await db.$disconnect(); fs.rmSync(storageDir, { recursive: true, force: true }); });

async function apiKey(scopes: string[]) {
  const secret = `cc_${Math.random().toString(36).slice(2)}`;
  await db.apiKey.create({ data: { name: "Vidéo", prefix: secret.slice(0, 8), keyHash: sha256(secret), scopes } });
  return secret;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("format des vidéos", () => {
  it("encode et relit le format dans le texte alternatif", () => {
    expect(parseVideoAlt(videoAlt("story", "Pub Coquelicot"))).toEqual({ format: "story", title: "Pub Coquelicot" });
    expect(parseVideoAlt("Ancienne vidéo")).toEqual({ format: null, title: "Ancienne vidéo" });
  });
});

describe("API /products/:id/videos", () => {
  it("enregistre une vidéo envoyée en multipart et la liste", async () => {
    const product = await createProductFixture({ slug: "tresor" });
    const key = await apiKey(["products:read", "products:write"]);
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], { type: "video/mp4" }), "pub.mp4");
    form.set("format", "story");
    form.set("title", "Pub 9:16");
    const res = await POST(new Request("http://localhost/api/v1/products/tresor/videos", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form }), ctx("tresor"));
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as { data: { id: string; url: string; format: string } };
    expect(data.format).toBe("story");
    const stored = await db.productImage.findUniqueOrThrow({ where: { id: data.id } });
    expect(stored).toMatchObject({ productId: product.id, role: "VIDEO", width: 1080, height: 1920 });
    expect(fs.existsSync(path.join(storageDir, stored.storageKey!))).toBe(true);

    const list = await GET(new Request("http://localhost/api/v1/products/tresor/videos", { headers: { authorization: `Bearer ${key}` } }), ctx(product.id));
    const body = (await list.json()) as { data: Array<{ format: string; title: string }> };
    expect(body.data).toEqual([expect.objectContaining({ format: "story", title: "Pub 9:16" })]);
  });

  it("refuse un fichier qui n'est pas une vidéo", async () => {
    await createProductFixture({ slug: "tresor" });
    const key = await apiKey(["products:write"]);
    const form = new FormData();
    form.set("file", new Blob(["x"], { type: "image/png" }), "a.png");
    const res = await POST(new Request("http://localhost/x", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form }), ctx("tresor"));
    expect(res.status).toBe(400);
  });

  it("indique que le téléversement direct est indisponible en stockage local (409)", async () => {
    await createProductFixture({ slug: "tresor" });
    const key = await apiKey(["products:write"]);
    const res = await POST(new Request("http://localhost/x", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ action: "presign", contentType: "video/mp4" }) }), ctx("tresor"));
    expect(res.status).toBe(409);
  });

  it("refuse l'enregistrement d'une clé de stockage étrangère au produit", async () => {
    const product = await createProductFixture({ slug: "tresor" });
    const key = await apiKey(["products:write"]);
    const res = await POST(new Request("http://localhost/x", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ action: "register", key: "private/products/x/kit.pdf", format: "story" }) }), ctx(product.id));
    expect(res.status).toBe(400);
  });

  it("exige le scope products:write", async () => {
    await createProductFixture({ slug: "tresor" });
    const key = await apiKey(["products:read"]);
    const res = await POST(new Request("http://localhost/x", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: "{}" }), ctx("tresor"));
    expect(res.status).toBe(403);
  });
});
