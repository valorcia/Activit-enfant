import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/db", () => ({ prisma: { generationLog: { create: async () => ({}) } } }));
import { generateStructured } from "@/lib/ai/structured";

const schema = z.object({ titre: z.string() });
const usage = { inputTokens: 1, outputTokens: 1, costUsd: 0 };

describe("generateStructured", () => {
  it("relance avec une limite doublée quand la réponse est coupée", async () => {
    const calls: Array<number | undefined> = [];
    const provider = {
      name: "test",
      complete: vi.fn(async (o: { maxTokens?: number }) => {
        calls.push(o.maxTokens);
        return calls.length === 1
          ? { text: '{"titre": "Les bébés dino', usage, provider: "test", model: "m", truncated: true }
          : { text: '{"titre": "Les bébés dinosaures"}', usage, provider: "test", model: "m" };
      }),
    };
    const r = await generateStructured({ provider, model: "m", schema, system: "s", prompt: "p", purpose: "kit_plan", maxTokens: 4000 });
    expect(r.data.titre).toBe("Les bébés dinosaures");
    expect(calls).toEqual([4000, 8000]);
  });

  it("explique une réponse vide au lieu de « received null »", async () => {
    const provider = { name: "test", complete: vi.fn(async () => ({ text: "", usage, provider: "test", model: "m" })) };
    await expect(generateStructured({ provider, model: "m", schema, system: "s", prompt: "p", purpose: "kit_plan" })).rejects.toThrow(/réponse vide/);
  });
});

describe("textes trop longs", () => {
  it("raccourcit un champ trop long au lieu d'échouer, sans nouvel appel", async () => {
    const s2 = z.object({ titre: z.string(), notes: z.string().max(50), tags: z.array(z.string()).max(2) });
    const long = "Un plan très détaillé ".repeat(10);
    const provider = { name: "test", complete: vi.fn(async () => ({ text: JSON.stringify({ titre: "Dino", notes: long, tags: ["a", "b", "c"] }), usage, provider: "test", model: "m" })) };
    const r = await generateStructured({ provider, model: "m", schema: s2, system: "s", prompt: "p", purpose: "kit_plan" });
    expect(r.data.notes.length).toBeLessThanOrEqual(50);
    expect(r.data.notes.endsWith("…")).toBe(true);
    expect(r.data.tags).toEqual(["a", "b"]);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it("ne masque pas une vraie erreur de structure", async () => {
    const provider = { name: "test", complete: vi.fn(async () => ({ text: JSON.stringify({ titre: 3 }), usage, provider: "test", model: "m" })) };
    await expect(generateStructured({ provider, model: "m", schema, system: "s", prompt: "p", purpose: "kit_plan" })).rejects.toThrow(/titre/);
  });
});
