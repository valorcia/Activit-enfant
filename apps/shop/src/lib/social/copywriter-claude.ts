import "server-only";
import { parseCopywriterOutput, type PostVariant } from "./copywriter";

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Appel API Claude (serveur). Lance une erreur si la clé est absente. */
export async function generateWithClaude(prompt: string): Promise<PostVariant[]> {
  if (!isClaudeConfigured()) throw new Error("ANTHROPIC_API_KEY non configurée : utilisez le mode copier-coller");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("La génération a été refusée par le modèle");
  const text = response.content.filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n");
  return parseCopywriterOutput(text);
}
