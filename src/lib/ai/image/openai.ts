import OpenAI, { toFile } from "openai";
import type { ImageProvider, ImageRequest, ImageResult } from "../types";
import { imageCost } from "../pricing";

export class OpenAIImageProvider implements ImageProvider {
  readonly name = "openai";
  private client: OpenAI;
  constructor() {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante (à définir côté serveur)");
    this.client = new OpenAI({ timeout: 10 * 60 * 1000 });
  }
  async generate(req: ImageRequest): Promise<ImageResult> {
    const prompt = req.negativePrompt ? `${req.prompt}\n\nÀ éviter absolument : ${req.negativePrompt}` : req.prompt;
    let b64: string | undefined;
    if (req.references && req.references.length > 0) {
      // Édition avec images de référence : conserve l'apparence des éléments déjà validés
      const files = await Promise.all(req.references.slice(0, 4).map((buf, i) => toFile(buf, `reference-${i}.png`, { type: "image/png" })));
      const res = await this.client.images.edit({ model: req.model, image: files, prompt, size: req.size, quality: req.quality, n: 1 });
      b64 = res.data?.[0]?.b64_json;
    } else {
      const res = await this.client.images.generate({ model: req.model, prompt, size: req.size, quality: req.quality, n: 1 });
      b64 = res.data?.[0]?.b64_json;
    }
    if (!b64) throw new Error("Le fournisseur d'images n'a renvoyé aucune image");
    const [w, h] = req.size.split("x").map(Number);
    return { data: Buffer.from(b64, "base64"), mime: "image/png", width: w, height: h, costUsd: imageCost(req.model, req.quality, req.size), provider: this.name, model: req.model, isDemo: false };
  }
}
