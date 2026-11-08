import "server-only";
import { getSecret } from "@/lib/integrations/secrets";
import { parseCopywriterOutput, type PostVariant } from "./copywriter";

/** Clé Claude : Administration → Paramètres → Intégrations (prioritaire) ou ANTHROPIC_API_KEY. */
export async function isClaudeConfigured(): Promise<boolean> {
  return Boolean(await getSecret("anthropic.apiKey"));
}

/** Appel API Claude (serveur). Lance une erreur si la clé est absente. */
export async function generateWithClaude(prompt: string): Promise<PostVariant[]> {
  const apiKey = await getSecret("anthropic.apiKey");
  if (!apiKey) throw new Error("Clé Claude non configurée : utilisez le mode copier-coller ou renseignez-la dans Paramètres → Intégrations");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
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
