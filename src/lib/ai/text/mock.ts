import type { TextProvider, TextResult } from "../types";
import { mockOutline, mockActivity, mockVisualReference, mockCover } from "./mock-content";

/**
 * Fournisseur de démonstration : produit des contenus plausibles, structurés et
 * explicitement marqués comme générés hors ligne. Il permet de tester tout le
 * pipeline (sommaire → fiches → références → mise en page → PDF) sans clé API.
 */
export class MockTextProvider implements TextProvider {
  readonly name = "mock";
  async complete(opts: { system: string; prompt: string; model: string; json?: boolean }): Promise<TextResult> {
    const p = opts.prompt;
    let out: unknown;
    const purpose = /<<purpose:(\w+)>>/.exec(p)?.[1] ?? "";
    const ctx = parseContext(p);
    if (purpose === "outline") out = mockOutline(ctx);
    else if (purpose === "activity") out = mockActivity(ctx);
    else if (purpose === "visual_reference") out = mockVisualReference(ctx);
    else if (purpose === "cover") out = mockCover(ctx);
    else out = { note: "mock" };
    await new Promise((r) => setTimeout(r, 150));
    return { text: JSON.stringify(out), provider: this.name, model: "mock", usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
  }
}

function parseContext(prompt: string): Record<string, string> {
  const ctx: Record<string, string> = {};
  const m = /<<context>>([\s\S]*?)<<\/context>>/.exec(prompt);
  if (m) {
    try {
      Object.assign(ctx, JSON.parse(m[1]));
    } catch {
      /* ignore */
    }
  }
  return ctx;
}
