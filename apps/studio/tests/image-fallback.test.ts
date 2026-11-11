import { describe, expect, it, vi } from "vitest";
import { isModelUnavailable, OpenAIImageProvider } from "@/lib/ai/image/openai";

describe("repli de modèle d'image OpenAI", () => {
  it("reconnaît un modèle inexistant, pas un refus de contenu", () => {
    expect(isModelUnavailable({ status: 400, message: "400 The model 'gpt-image-1' does not exist." })).toBe(true);
    expect(isModelUnavailable({ code: "model_not_found" })).toBe(true);
    expect(isModelUnavailable({ status: 400, message: "Your request was rejected by the safety system." })).toBe(false);
    expect(isModelUnavailable({ status: 429, message: "Rate limit" })).toBe(false);
  });

  it("produit l'image avec le modèle suivant et enregistre le modèle réellement utilisé", async () => {
    process.env.OPENAI_API_KEY = "test";
    const p = new OpenAIImageProvider();
    const png = Buffer.from("png").toString("base64");
    const generate = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("400 The model 'gpt-image-1' does not exist."), { status: 400 }))
      .mockResolvedValueOnce({ data: [{ b64_json: png }] });
    (p as unknown as { client: { images: { generate: typeof generate } } }).client = { images: { generate } };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await p.generate({ prompt: "couverture", size: "1024x1024", quality: "high", model: "gpt-image-1" } as never);
    expect(r.model).toBe("gpt-image-1-mini");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0].model).toBe("gpt-image-1-mini");
  });
});
