import { prisma } from "../../db";
import { getStorage } from "../../storage";
import type { ImageProvider, ImageRequest, ImageResult } from "../types";
import { ManualInputRequiredError, buildImagePrompt, fingerprint } from "../manual-core";
import type { ManualContext } from "../text/manual";

/**
 * Fournisseur d'images « copier-coller » : le prompt est copié dans ChatGPT (ou tout
 * générateur), l'image produite est téléversée dans la page « À coller ».
 */
export class ManualImageProvider implements ImageProvider {
  readonly name = "manual";
  constructor(private readonly ctx: ManualContext = {}) {}

  async generate(req: ImageRequest): Promise<ImageResult> {
    const fp = fingerprint("IMAGE", { prompt: req.prompt, negative: req.negativePrompt ?? "", size: req.size });
    const existing = await prisma.manualRequest.findUnique({ where: { fingerprint: fp }, include: { asset: true } });
    if (existing?.status === "DONE" && existing.asset) {
      const data = await getStorage().get(existing.asset.key);
      return { data, mime: existing.asset.mime, width: existing.asset.width ?? 0, height: existing.asset.height ?? 0, costUsd: 0, provider: this.name, model: "manual", isDemo: false };
    }
    const title = req.label ? `Illustration : ${req.label}` : "Illustration";
    const request =
      existing && existing.status !== "DONE"
        ? await prisma.manualRequest.update({ where: { id: existing.id }, data: { status: "PENDING", error: null, jobId: this.ctx.jobId ?? existing.jobId, bookId: this.ctx.bookId ?? existing.bookId, activityId: this.ctx.activityId ?? existing.activityId } })
        : await prisma.manualRequest.create({
            data: {
              kind: "IMAGE",
              fingerprint: fp,
              title,
              prompt: buildImagePrompt({ prompt: req.prompt, negativePrompt: req.negativePrompt, size: req.size, quality: req.quality }),
              expectedFormat: `Une image PNG, JPG ou WebP (${req.size} px ou plus) à téléverser.`,
              purpose: "illustration",
              params: { size: req.size, quality: req.quality, references: req.references?.length ?? 0 },
              bookId: this.ctx.bookId,
              activityId: this.ctx.activityId,
              jobId: this.ctx.jobId,
            },
          });
    throw new ManualInputRequiredError(request.id, title, "IMAGE");
  }
}
