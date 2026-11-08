import { createHash } from "node:crypto";

/**
 * Fonctions pures du mode copier-coller (sans accès à la base) :
 * empreintes, préparation des prompts à copier, découpage des collages multiples.
 */

/** Levée par les fournisseurs « manual » quand une réponse doit être collée par l'utilisateur. */
export class ManualInputRequiredError extends Error {
  readonly code = "MANUAL_INPUT_REQUIRED";
  constructor(public readonly requestId: string, public readonly title: string, public readonly kind: "TEXT" | "IMAGE") {
    super(`Réponse à coller : ${title}`);
    this.name = "ManualInputRequiredError";
  }
}

export function isManualInputRequired(err: unknown): err is ManualInputRequiredError {
  return err instanceof ManualInputRequiredError || (typeof err === "object" && err !== null && (err as { code?: string }).code === "MANUAL_INPUT_REQUIRED");
}

/** Empreinte stable d'une demande (même prompt + mêmes paramètres → même demande). */
export function fingerprint(kind: "TEXT" | "IMAGE", payload: Record<string, unknown>): string {
  const ordered = Object.keys(payload).sort().map((k) => [k, payload[k]]);
  return createHash("sha256").update(JSON.stringify([kind, ordered])).digest("hex");
}

/** Retire les blocs internes (<<purpose>>, <<context>>) destinés au fournisseur de démonstration. */
export function stripInternalBlocks(prompt: string): string {
  return prompt
    .replace(/<<purpose:\w+>>\s*/g, "")
    .replace(/<<context>>[\s\S]*?<<\/context>>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function purposeOf(prompt: string): string | null {
  return /<<purpose:(\w+)>>/.exec(prompt)?.[1] ?? null;
}

export function contextOf(prompt: string): Record<string, unknown> {
  const m = /<<context>>([\s\S]*?)<<\/context>>/.exec(prompt);
  if (!m) return {};
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const PURPOSE_LABELS: Record<string, string> = {
  outline: "Sommaire du livre",
  activity: "Fiche",
  visual_reference: "Fiche de référence visuelle",
  cover: "Textes de couverture",
  kit_hunt: "Contenu du kit (chasse au trésor)",
  kit_pranks: "Contenu du kit (idées)",
  kit_plan: "Plan de kit depuis un brief",
  qc: "Contrôle qualité",
  repair: "Réparation",
};

/** Titre lisible d'une demande texte : « Fiche : Le volcan », « Sommaire du livre : Les Petits Inventeurs »… */
export function textRequestTitle(prompt: string): string {
  const purpose = purposeOf(prompt) ?? "";
  const ctx = contextOf(prompt);
  const subject = typeof ctx.title === "string" && ctx.title ? ctx.title : null;
  const label = PURPOSE_LABELS[purpose] ?? "Texte";
  return subject ? `${label} : ${subject}` : label;
}

export const JSON_ONLY_INSTRUCTION =
  "IMPORTANT : réponds uniquement avec l'objet JSON demandé, sans texte avant ou après, sans balises de code. Le JSON doit être complet et valide.";

/** Prompt complet à copier dans Claude / ChatGPT pour une demande texte. */
export function buildTextPrompt(system: string, prompt: string): string {
  return [system.trim(), stripInternalBlocks(prompt), JSON_ONLY_INSTRUCTION].filter(Boolean).join("\n\n");
}

/** Prompt complet à copier dans un générateur d'images. */
export function buildImagePrompt(opts: { prompt: string; negativePrompt?: string; size: string; quality: string }): string {
  const [w, h] = opts.size.split("x");
  const ratio = w === h ? "carré (1:1)" : Number(w) > Number(h) ? "paysage (3:2)" : "portrait (2:3)";
  const lines = [opts.prompt.trim(), "", `Format : ${ratio}, ${w}×${h} px minimum. Qualité : ${opts.quality === "high" ? "haute, prête pour l'impression" : opts.quality === "low" ? "esquisse" : "soignée"}.`];
  if (opts.negativePrompt?.trim()) lines.push(`À éviter : ${opts.negativePrompt.trim()}.`);
  lines.push("Pas de texte ni de lettres dans l'image.");
  return lines.join("\n");
}

/** Nettoie une réponse collée : balises ```json, texte autour, guillemets typographiques. */
export function cleanPastedJson(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json|JSON)?\s*/m, "").replace(/```\s*$/m, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return t.trim();
}

export const BATCH_HEADER = "### DEMANDE";

/** Assemble plusieurs demandes texte en un seul prompt (un collage dans Claude). */
export function buildBatchPrompt(items: { id: string; title: string; prompt: string }[]): string {
  const intro = `Tu vas traiter ${items.length} demandes indépendantes. Pour CHAQUE demande, réponds dans l'ordre en commençant par une ligne exactement égale à « ${BATCH_HEADER} <identifiant> » puis l'objet JSON demandé, sans autre texte. Ne fusionne pas les réponses.`;
  const blocks = items.map((it) => `${BATCH_HEADER} ${it.id}\n(${it.title})\n\n${it.prompt}`);
  return [intro, ...blocks].join("\n\n──────────\n\n");
}

/** Découpe un collage multi-réponses : sections « ### DEMANDE <id> » suivies du JSON. */
export function splitBatchResponse(text: string): { id: string; body: string }[] {
  const re = new RegExp(`${BATCH_HEADER}\\s+([A-Za-z0-9_-]+)`, "g");
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) return [];
  return matches.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    return { id: m[1], body: text.slice(start, end).trim() };
  });
}
