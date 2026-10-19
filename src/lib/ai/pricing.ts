// Tarifs indicatifs (USD) utilisés pour l'estimation et le suivi des coûts.
// Ils sont volontairement centralisés ici pour être ajustés facilement.

export const TEXT_PRICES: Record<string, { input: number; output: number }> = {
  // Anthropic — $ par million de tokens
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  // OpenAI — estimations
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  mock: { input: 0, output: 0 },
};

export const IMAGE_PRICES: Record<string, Record<string, number>> = {
  // $ par image (1024x1024) selon la qualité — estimations
  "gpt-image-1": { low: 0.011, medium: 0.042, high: 0.167 },
  "gpt-image-1-mini": { low: 0.005, medium: 0.011, high: 0.036 },
  mock: { low: 0, medium: 0, high: 0 },
};

export function textCost(model: string, inputTokens: number, outputTokens: number) {
  const p = TEXT_PRICES[model] ?? { input: 3, output: 15 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function imageCost(model: string, quality: "low" | "medium" | "high", size: string) {
  const base = IMAGE_PRICES[model]?.[quality] ?? 0.05;
  return size === "1024x1024" ? base : base * 1.5;
}

export const TEXT_MODELS: Record<string, { label: string; value: string }[]> = {
  anthropic: [
    { label: "Claude Opus 5.5 (recommandé)", value: "claude-opus-5-5" },
    { label: "Claude Sonnet 5.5", value: "claude-sonnet-5-5" },
    { label: "Claude Haiku 5.5 (économique)", value: "claude-haiku-5-5" },
    { label: "Claude Fable 5.1", value: "claude-fable-5-1" },
  ],
  openai: [
    { label: "GPT-5", value: "gpt-5" },
    { label: "GPT-5 mini", value: "gpt-5-mini" },
    { label: "GPT-4.1", value: "gpt-4.1" },
  ],
  mock: [{ label: "Générateur de démonstration (hors ligne)", value: "mock" }],
};

export const IMAGE_MODELS: Record<string, { label: string; value: string }[]> = {
  openai: [
    { label: "GPT Image 1", value: "gpt-image-1" },
    { label: "GPT Image 1 mini", value: "gpt-image-1-mini" },
  ],
  mock: [{ label: "Images de démonstration (étiquetées)", value: "mock" }],
};
