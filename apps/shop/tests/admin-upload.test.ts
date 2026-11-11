import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getAdminUser: async () => ({ id: "u1", role: "ADMIN", email: "admin@example.com" }) }));

import { POST as chunkPOST } from "@/app/api/admin/upload/chunk/route";
import { POST as uploadPOST } from "@/app/api/admin/upload/route";
import { getStorage } from "@/lib/storage";
import { chunkKey, CHUNK_BYTES } from "@/lib/admin/upload";

describe("envoi d'un gros fichier en morceaux (limite Vercel de 4,5 Mo)", () => {
  it("assemble les morceaux en un seul PDF privé identique et supprime les morceaux", async () => {
    const total = Math.floor(CHUNK_BYTES * 2.4);
    const original = Buffer.alloc(total);
    for (let i = 0; i < total; i++) original[i] = (i * 31) % 251;
    original.write("%PDF-1.7", 0);
    const uploadId = "test0123456789abcdef";
    const parts = Math.ceil(total / CHUNK_BYTES);

    for (let i = 0; i < parts; i++) {
      const fd = new FormData();
      fd.append("uploadId", uploadId);
      fd.append("index", String(i));
      fd.append("chunk", new Blob([original.subarray(i * CHUNK_BYTES, Math.min(total, (i + 1) * CHUNK_BYTES))]));
      const res = await chunkPOST(new Request("http://x/api/admin/upload/chunk", { method: "POST", body: fd }));
      expect(res.status).toBe(200);
    }

    const res = await uploadPOST(new Request("http://x/api/admin/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploadId, parts, name: "Mon livre.pdf", mime: "application/pdf", scope: "private", productId: "prod1" }),
    }));
    expect(res.status).toBe(200);
    const json = await res.json() as { key: string; size: number };
    expect(json.key).toMatch(/^private\/products\/prod1\/.+-Mon-livre\.pdf$/);
    expect(json.size).toBe(total);

    const storage = getStorage();
    const stored = await storage.get(json.key);
    expect(stored?.body.equals(original)).toBe(true);
    expect(await storage.exists(chunkKey(uploadId, 0))).toBe(false);
    await storage.delete(json.key);
  });

  it("refuse un morceau trop gros et un identifiant invalide", async () => {
    const fd = new FormData();
    fd.append("uploadId", "../../etc");
    fd.append("index", "0");
    fd.append("chunk", new Blob([Buffer.alloc(10)]));
    expect((await chunkPOST(new Request("http://x", { method: "POST", body: fd }))).status).toBe(400);

    const big = new FormData();
    big.append("uploadId", "test0123456789abcdef");
    big.append("index", "0");
    big.append("chunk", new Blob([Buffer.alloc(CHUNK_BYTES + 5000)]));
    expect((await chunkPOST(new Request("http://x", { method: "POST", body: big }))).status).toBe(413);
  });
});
