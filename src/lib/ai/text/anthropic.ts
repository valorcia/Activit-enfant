import Anthropic from "@anthropic-ai/sdk";
import type { TextProvider, TextResult } from "../types";
import { textCost } from "../pricing";

export class AnthropicTextProvider implements TextProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquante (à définir côté serveur)");
    this.client = new Anthropic({ timeout: 10 * 60 * 1000 });
  }

  async complete(opts: { system: string; prompt: string; model: string; maxTokens?: number; json?: boolean }): Promise<TextResult> {
    const system = opts.json
      ? `${opts.system}\n\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après, sans balises de code.`
      : opts.system;

    // Fable 5.1 : repli serveur recommandé en cas de refus des classificateurs.
    const isFable = opts.model.startsWith("claude-fable");
    const stream = isFable
      ? this.client.beta.messages.stream({
          model: opts.model,
          max_tokens: opts.maxTokens ?? 16000,
          system,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          messages: [{ role: "user", content: opts.prompt }],
        } as Parameters<typeof this.client.beta.messages.stream>[0])
      : this.client.messages.stream({
          model: opts.model,
          max_tokens: opts.maxTokens ?? 16000,
          system,
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
          messages: [{ role: "user", content: opts.prompt }],
        } as Parameters<typeof this.client.messages.stream>[0]);

    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      throw new Error("Le modèle a refusé la requête (classificateur de sécurité).");
    }
    const blocks = message.content as Array<{ type: string; text?: string }>;
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n");
    const inputTokens = message.usage.input_tokens ?? 0;
    const outputTokens = message.usage.output_tokens ?? 0;
    return {
      text,
      provider: this.name,
      model: message.model ?? opts.model,
      usage: { inputTokens, outputTokens, costUsd: textCost(opts.model, inputTokens, outputTokens) },
    };
  }
}
