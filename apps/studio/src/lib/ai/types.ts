import type { z } from "zod";

export type GenerationPurpose = "outline" | "activity" | "visual_reference" | "illustration" | "cover" | "qc" | "repair";

export interface TextUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface TextResult {
  text: string;
  usage: TextUsage;
  provider: string;
  model: string;
}

export interface TextProvider {
  readonly name: string;
  /** Génère une réponse texte. Le prompt système décrit le rôle, le prompt utilisateur la tâche. */
  complete(opts: { system: string; prompt: string; model: string; maxTokens?: number; json?: boolean }): Promise<TextResult>;
}

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  size: "1024x1024" | "1536x1024" | "1024x1536";
  quality: "low" | "medium" | "high";
  model: string;
  /** Images de référence (PNG) pour conserver la cohérence entre étapes */
  references?: Buffer[];
  /** Texte d'étiquette (utilisé uniquement par le fournisseur de démonstration) */
  label?: string;
}

export interface ImageResult {
  data: Buffer;
  mime: string;
  width: number;
  height: number;
  costUsd: number;
  provider: string;
  model: string;
  /** true si l'image est une image de démonstration et non une illustration réelle */
  isDemo: boolean;
}

export interface ImageProvider {
  readonly name: string;
  generate(req: ImageRequest): Promise<ImageResult>;
}

export interface StructuredResult<T> {
  data: T;
  usage: TextUsage;
  provider: string;
  model: string;
  raw: string;
}

export type ZodSchema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;
