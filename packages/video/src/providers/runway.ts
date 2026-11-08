import { toDataUri, type GenerateFromImageInput, type VideoJobState, type VideoProvider, type VideoRatio } from "./types";

/**
 * Runway — image → vidéo (Gen-4 Turbo).
 * API : POST {base}/v1/image_to_video puis GET {base}/v1/tasks/{id}.
 * Paramètres repris de la documentation publique Runway (version d'API 2024-11-06) ;
 * à revérifier sur developers.runwayml.com en cas d'évolution.
 */
export const RUNWAY_DEFAULTS = {
  baseUrl: "https://api.dev.runwayml.com",
  apiVersion: "2024-11-06",
  model: "gen4_turbo",
  /** Gen-4 Turbo : 5 crédits par seconde, 1 crédit = 0,01 $ (tarif public à confirmer). */
  creditsPerSecond: 5,
  usdPerCredit: 0.01,
};

export const RUNWAY_RATIOS: Record<VideoRatio, string> = {
  portrait: "720:1280",
  square: "960:960",
  landscape: "1280:720",
};

export interface RunwayOptions {
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
  model?: string;
  creditsPerSecond?: number;
  usdPerCredit?: number;
  fetchImpl?: typeof fetch;
}

const STATUS_MAP: Record<string, VideoJobState["status"]> = {
  PENDING: "pending",
  THROTTLED: "pending",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "failed",
};

export class RunwayProvider implements VideoProvider {
  readonly name = "runway";
  private readonly opts: Required<Omit<RunwayOptions, "fetchImpl">> & { fetchImpl: typeof fetch };

  constructor(options: RunwayOptions) {
    if (!options.apiKey) throw new Error("Clé Runway manquante (RUNWAY_API_KEY)");
    this.opts = {
      apiKey: options.apiKey,
      baseUrl: (options.baseUrl ?? RUNWAY_DEFAULTS.baseUrl).replace(/\/$/, ""),
      apiVersion: options.apiVersion ?? RUNWAY_DEFAULTS.apiVersion,
      model: options.model ?? RUNWAY_DEFAULTS.model,
      creditsPerSecond: options.creditsPerSecond ?? RUNWAY_DEFAULTS.creditsPerSecond,
      usdPerCredit: options.usdPerCredit ?? RUNWAY_DEFAULTS.usdPerCredit,
      fetchImpl: options.fetchImpl ?? fetch,
    };
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.opts.apiKey}`,
      "X-Runway-Version": this.opts.apiVersion,
      "Content-Type": "application/json",
    };
  }

  buildRequestBody(input: GenerateFromImageInput) {
    const promptImage = input.imageUrl ?? (input.imageBuffer ? toDataUri(input.imageBuffer, input.imageMime) : undefined);
    if (!promptImage) throw new Error("Image de départ requise (imageUrl ou imageBuffer)");
    if (promptImage.startsWith("http://")) throw new Error("Runway exige une URL https ou une data URI");
    return {
      model: this.opts.model,
      promptImage,
      promptText: input.prompt.slice(0, 1000),
      ratio: RUNWAY_RATIOS[input.ratio],
      duration: input.durationSeconds,
      ...(input.seed != null ? { seed: input.seed } : {}),
    };
  }

  async generateFromImage(input: GenerateFromImageInput): Promise<{ jobId: string }> {
    const res = await this.opts.fetchImpl(`${this.opts.baseUrl}/v1/image_to_video`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.buildRequestBody(input)),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; message?: string };
    if (!res.ok || !data.id) throw new Error(`Runway a refusé la demande (${res.status}) : ${data.error ?? data.message ?? "réponse inattendue"}`);
    return { jobId: data.id };
  }

  async getStatus(jobId: string): Promise<VideoJobState> {
    const res = await this.opts.fetchImpl(`${this.opts.baseUrl}/v1/tasks/${encodeURIComponent(jobId)}`, { headers: this.headers() });
    const data = (await res.json().catch(() => ({}))) as { status?: string; output?: string[]; failure?: string; progress?: number };
    if (!res.ok) return { status: "failed", error: `Runway (${res.status}) : ${data.failure ?? "erreur de suivi"}` };
    const status = STATUS_MAP[data.status ?? ""] ?? "pending";
    return { status, videoUrl: data.output?.[0], error: data.failure, progress: data.progress };
  }

  estimateCostUsd(durationSeconds: number): number {
    return Math.round(durationSeconds * this.opts.creditsPerSecond * this.opts.usdPerCredit * 100) / 100;
  }
}
