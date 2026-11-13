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
