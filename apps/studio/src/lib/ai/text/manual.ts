import { prisma } from "../../db";
import type { TextProvider, TextResult } from "../types";
import { ManualInputRequiredError, buildTextPrompt, fingerprint, purposeOf, textRequestTitle } from "../manual-core";
import { MANUAL_SCHEMA_BY_PURPOSE } from "../manual-schemas";

/** Contexte (livre / activité / tâche) transmis aux demandes pour les relier dans l'interface. */
export interface ManualContext {
  bookId?: string;
  activityId?: string;
  jobId?: string;
}

/**
 * Fournisseur texte « copier-coller » : aucun appel réseau.
 * - Réponse déjà collée pour ce prompt → la renvoie comme le ferait une API.
 * - Sinon → enregistre la demande (prompt complet à copier) et lève ManualInputRequiredError.
 */
export class ManualTextProvider implements TextProvider {
  readonly name = "manual";
  constructor(private readonly ctx: ManualContext = {}) {}

  async complete(opts: { system: string; prompt: string; model: string; maxTokens?: number; json?: boolean }): Promise<TextResult> {
    const fp = fingerprint("TEXT", { system: opts.system, prompt: opts.prompt, json: Boolean(opts.json) });
    const existing = await prisma.manualRequest.findUnique({ where: { fingerprint: fp } });
    if (existing?.status === "DONE" && existing.responseText) {
      return { text: existing.responseText, provider: this.name, model: "manual", usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
    }
    const purpose = purposeOf(opts.prompt);
    const title = textRequestTitle(opts.prompt);
    const schemaName = purpose ? (MANUAL_SCHEMA_BY_PURPOSE[purpose]?.name ?? null) : null;
    const request =
      existing && existing.status !== "DONE"
        ? await prisma.manualRequest.update({ where: { id: existing.id }, data: { status: "PENDING", error: null, jobId: this.ctx.jobId ?? existing.jobId, bookId: this.ctx.bookId ?? existing.bookId, activityId: this.ctx.activityId ?? existing.activityId } })
        : await prisma.manualRequest.create({
            data: {
              kind: "TEXT",
              fingerprint: fp,
              title,
              prompt: buildTextPrompt(opts.system, opts.prompt),
              expectedFormat: "Un objet JSON complet conforme au format décrit dans le prompt (sans texte autour).",
              schemaName,
              purpose,
              bookId: this.ctx.bookId,
              activityId: this.ctx.activityId,
              jobId: this.ctx.jobId,
            },
          });
    throw new ManualInputRequiredError(request.id, title, "TEXT");
  }
}
