import type { z } from "zod";
import { prisma } from "../db";
import type { GenerationPurpose, StructuredResult, TextProvider } from "./types";

/**
 * Appelle un fournisseur texte en demandant du JSON, valide avec Zod et tente
 * une réparation si la réponse ne respecte pas le schéma. Chaque appel est
 * journalisé dans GenerationLog (coût, tokens, succès).
 */
export async function generateStructured<T>(opts: {
  provider: TextProvider;
  model: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  system: string;
  prompt: string;
  purpose: GenerationPurpose;
  bookId?: string;
  activityId?: string;
  jobId?: string;
  maxTokens?: number;
}): Promise<StructuredResult<T>> {
  let lastError = "";
  let prompt = opts.prompt;
  const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    let text = "";
    try {
      const res = await opts.provider.complete({ system: opts.system, prompt, model: opts.model, json: true, maxTokens: opts.maxTokens });
      text = res.text;
      usage.inputTokens += res.usage.inputTokens;
      usage.outputTokens += res.usage.outputTokens;
      usage.costUsd += res.usage.costUsd;
      await log({ ...opts, provider: res.provider, model: res.model, usage: res.usage, durationMs: Date.now() - started, success: true });
      const parsed = opts.schema.safeParse(extractJson(text));
      if (parsed.success) return { data: parsed.data, usage, provider: res.provider, model: res.model, raw: text };
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      prompt = `${opts.prompt}\n\nTa réponse précédente ne respectait pas le schéma. Erreurs : ${lastError}\nRéponse précédente :\n${text.slice(0, 6000)}\n\nCorrige et renvoie l'objet JSON complet et valide.`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await log({ ...opts, provider: opts.provider.name, model: opts.model, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }, durationMs: Date.now() - started, success: false, error: message });
      throw err;
    }
  }
  throw new Error(`Réponse IA invalide après réparation : ${lastError}`);
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function log(o: {
  provider: string;
  model: string;
  purpose: GenerationPurpose;
  bookId?: string;
  activityId?: string;
  jobId?: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  durationMs: number;
  success: boolean;
  error?: string;
}) {
  try {
    await prisma.generationLog.create({
      data: {
        kind: "text",
        provider: o.provider,
        model: o.model,
        purpose: o.purpose,
        bookId: o.bookId,
        activityId: o.activityId,
        jobId: o.jobId,
        inputTokens: o.usage.inputTokens,
        outputTokens: o.usage.outputTokens,
        costUsd: o.usage.costUsd,
        durationMs: o.durationMs,
        success: o.success,
        error: o.error,
      },
    });
  } catch {
    /* le journal ne doit jamais bloquer la génération */
  }
}

/** Contexte structuré inséré dans le prompt (lu aussi par le fournisseur de démonstration). */
export function contextBlock(purpose: GenerationPurpose, ctx: Record<string, unknown>) {
  return `<<purpose:${purpose}>>\n<<context>>${JSON.stringify(ctx)}<</context>>`;
}
