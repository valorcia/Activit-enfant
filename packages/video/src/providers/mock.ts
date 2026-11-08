import type { GenerateFromImageInput, VideoJobState, VideoProvider } from "./types";

/** Fournisseur factice pour les tests : renvoie l'URL configurée (ex. un petit MP4 local). */
export class MockVideoProvider implements VideoProvider {
  readonly name = "mock";
  readonly calls: GenerateFromImageInput[] = [];
  constructor(private readonly videoUrl = "mock://clip.mp4") {}

  async generateFromImage(input: GenerateFromImageInput): Promise<{ jobId: string }> {
    this.calls.push(input);
    return { jobId: `mock-${this.calls.length}` };
  }

  async getStatus(): Promise<VideoJobState> {
    return { status: "succeeded", videoUrl: this.videoUrl, progress: 1 };
  }

  estimateCostUsd(): number {
    return 0;
  }
}
