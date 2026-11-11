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
    // Un modèle retiré ou non ouvert au compte (« does not exist ») ne doit pas bloquer le livre :
    // on retombe sur un modèle disponible, et le modèle réellement utilisé est enregistré.
    const chain = [req.model, ...IMAGE_MODEL_FALLBACKS.filter((m) => m !== req.model)];
    let lastErr: unknown;
    for (const model of chain) {
      try {
        const data = await this.call(req, model);
        if (model !== req.model) console.warn(`[images] modèle « ${req.model} » indisponible pour ce compte OpenAI : image produite avec « ${model} »`);
        const [w, h] = req.size.split("x").map(Number);
        return { data, mime: "image/png", width: w, height: h, costUsd: imageCost(model, req.quality, req.size), provider: this.name, model, isDemo: false };
      } catch (err) {
        if (!isModelUnavailable(err)) throw err;
        lastErr = err;
      }
    }
    throw lastErr;
  }

  private async call(req: ImageRequest, model: string): Promise<Buffer> {
    const prompt = req.negativePrompt ? `${req.prompt}\n\nÀ éviter absolument : ${req.negativePrompt}` : req.prompt;
    let b64: string | undefined;
    if (req.references && req.references.length > 0) {
      // Édition avec images de référence : conserve l'apparence des éléments déjà validés
      const files = await Promise.all(req.references.slice(0, 4).map((buf, i) => toFile(buf, `reference-${i}.png`, { type: "image/png" })));
      const res = await this.client.images.edit({ model, image: files, prompt, size: req.size, quality: req.quality, n: 1 });
      b64 = res.data?.[0]?.b64_json;
    } else {
      const res = await this.client.images.generate({ model, prompt, size: req.size, quality: req.quality, n: 1 });
      b64 = res.data?.[0]?.b64_json;
    }
    if (!b64) throw new Error("Le fournisseur d'images n'a renvoyé aucune image");
    return Buffer.from(b64, "base64");
  }
}

/** Modèles de repli, du meilleur au plus économique. */
export const IMAGE_MODEL_FALLBACKS = ["gpt-image-1", "gpt-image-1-mini"];

/** Erreur OpenAI « modèle inexistant / non accessible » (et non une erreur de contenu ou de quota). */
export function isModelUnavailable(err: unknown): boolean {
  const e = err as { status?: number; code?: string; message?: string } | null;
  const msg = (e?.message ?? "").toLowerCase();
  if (e?.code === "model_not_found") return true;
  return (e?.status === 400 || e?.status === 404 || e?.status === 403) && /model .*(does not exist|not found|do not have access)|model_not_found/.test(msg);
}
