import OpenAI from "openai";
import type { TextProvider, TextResult } from "../types";
import { textCost } from "../pricing";

export class OpenAITextProvider implements TextProvider {
  readonly name = "openai";
  private client: OpenAI;
  constructor() {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante (à définir côté serveur)");
    this.client = new OpenAI({ timeout: 10 * 60 * 1000 });
  }
  async complete(opts: { system: string; prompt: string; model: string; maxTokens?: number; json?: boolean }): Promise<TextResult> {
    const res = await this.client.chat.completions.create({
      model: opts.model,
      messages: [
        { role: "system", content: opts.json ? `${opts.system}\n\nRéponds uniquement en JSON valide.` : opts.system },
        { role: "user", content: opts.prompt },
      ],
      max_completion_tokens: opts.maxTokens ?? 16000,
      ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    });
    const text = res.choices[0]?.message?.content ?? "";
    const inputTokens = res.usage?.prompt_tokens ?? 0;
    const outputTokens = res.usage?.completion_tokens ?? 0;
    return { text, provider: this.name, model: res.model ?? opts.model, usage: { inputTokens, outputTokens, costUsd: textCost(opts.model, inputTokens, outputTokens) } };
  }
}
