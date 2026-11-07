import { z } from "zod";

export const AiSettingsSchema = z.object({
  textProvider: z.enum(["anthropic", "openai", "mock"]).default("mock"),
  textModel: z.string().default("claude-opus-5-5"),
  imageProvider: z.enum(["openai", "mock"]).default("mock"),
  imageModel: z.string().default("gpt-image-1"),
  imageQuality: z.enum(["low", "medium", "high"]).default("medium"),
  imageSize: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
  stepIllustrations: z.boolean().default(true),
  maxStepIllustrations: z.number().int().min(0).max(15).default(8),
  maxBudgetPerBookUsd: z.number().min(0).default(50),
  maxConcurrentGenerations: z.number().int().min(1).max(10).default(2),
  language: z.string().default("fr"),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export const DEFAULT_AI_SETTINGS: AiSettings = AiSettingsSchema.parse({});
