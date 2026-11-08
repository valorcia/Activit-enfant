export type VideoRatio = "portrait" | "square" | "landscape";

export interface GenerateFromImageInput {
  /** URL https ou data URI de l'illustration de départ. */
  imageUrl?: string;
  /** Contenu binaire de l'image (converti en data URI si besoin). */
  imageBuffer?: Buffer;
  imageMime?: string;
  /** Prompt de mouvement (anglais recommandé). */
  prompt: string;
  durationSeconds: 5 | 10;
  ratio: VideoRatio;
  seed?: number;
}

export type VideoJobStatus = "pending" | "running" | "succeeded" | "failed";

export interface VideoJobState {
  status: VideoJobStatus;
  videoUrl?: string;
  error?: string;
  progress?: number;
}

export interface VideoProvider {
  readonly name: string;
  generateFromImage(input: GenerateFromImageInput): Promise<{ jobId: string }>;
  getStatus(jobId: string): Promise<VideoJobState>;
  estimateCostUsd(durationSeconds: number): number;
}

/** Erreur levée par le mode copier-coller : la vidéo doit être produite à la main puis fournie en fichier. */
export class ManualVideoRequiredError extends Error {
  constructor(public readonly instructions: string, public readonly prompt: string) {
    super("Animation à produire manuellement : copiez le prompt dans Runway, Sora ou Veo, puis fournissez le fichier MP4.");
    this.name = "ManualVideoRequiredError";
  }
}

export function toDataUri(buffer: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** Attend la fin d'un job (sondage), avec délai maximal. */
export async function waitForVideo(provider: VideoProvider, jobId: string, opts: { intervalMs?: number; timeoutMs?: number; onProgress?: (s: VideoJobState) => void } = {}): Promise<VideoJobState> {
  const interval = opts.intervalMs ?? 5000;
  const deadline = Date.now() + (opts.timeoutMs ?? 10 * 60_000);
  for (;;) {
    const state = await provider.getStatus(jobId);
    opts.onProgress?.(state);
    if (state.status === "succeeded" || state.status === "failed") return state;
    if (Date.now() > deadline) return { status: "failed", error: "Délai dépassé en attendant la vidéo" };
    await new Promise((r) => setTimeout(r, interval));
  }
}
