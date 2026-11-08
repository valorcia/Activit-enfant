import { ManualVideoRequiredError, type GenerateFromImageInput, type VideoJobState, type VideoProvider } from "./types";

/**
 * Mode copier-coller : aucun appel d'API. Le prompt et les réglages sont rendus
 * prêts à coller dans Runway, Sora ou Veo ; la vidéo est ensuite fournie en fichier.
 */
export class ManualVideoProvider implements VideoProvider {
  readonly name = "manual";

  instructions(input: GenerateFromImageInput): string {
    const ratio = input.ratio === "portrait" ? "9:16 (vertical)" : input.ratio === "square" ? "1:1 (carré)" : "16:9 (paysage)";
    return [
      "1. Ouvrez l'outil d'animation (Runway : app.runwayml.com, Sora : sora.com, Veo : gemini.google.com).",
      "2. Choisissez « image vers vidéo » et importez l'illustration de départ.",
      `3. Réglages : format ${ratio}, durée ${input.durationSeconds} s.`,
      "4. Collez le prompt ci-dessous, générez, puis téléchargez le MP4.",
      "5. Fournissez le fichier au studio (ou à `ad render --clip fichier.mp4`).",
      "",
      "PROMPT :",
      input.prompt,
    ].join("\n");
  }

  async generateFromImage(input: GenerateFromImageInput): Promise<{ jobId: string }> {
    throw new ManualVideoRequiredError(this.instructions(input), input.prompt);
  }

  async getStatus(): Promise<VideoJobState> {
    return { status: "pending" };
  }

  estimateCostUsd(): number {
    return 0;
  }
}
