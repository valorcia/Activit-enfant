import { z } from "zod";

/**
 * Génération des textes de posts et de publicités pour un e-book.
 * Deux chemins : l'API Claude (si ANTHROPIC_API_KEY est défini) ou le mode
 * copier-coller (prompt à copier dans Claude.ai / ChatGPT, JSON à coller).
 * Dans les deux cas la sortie est validée par le même schéma.
 */

export const CHANNELS = ["instagram", "facebook", "tiktok", "meta_ad"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram: "Instagram (publication)",
  facebook: "Facebook (publication de Page)",
  tiktok: "TikTok (photo / légende)",
  meta_ad: "Publicité Meta (texte principal + titre)",
};

const LIMITS: Record<Channel, { body: number; hook: number; headline?: number; hashtags: number }> = {
  instagram: { body: 2200, hook: 125, hashtags: 15 },
  facebook: { body: 1500, hook: 120, hashtags: 5 },
  tiktok: { body: 300, hook: 80, hashtags: 8 },
  meta_ad: { body: 125, hook: 40, headline: 40, hashtags: 0 },
};

export const variantSchema = z.object({
  channel: z.enum(CHANNELS),
  label: z.string().max(60),
  hook: z.string().max(200),
  body: z.string().max(2400),
  cta: z.string().max(80),
  headline: z.string().max(60).optional().nullable(),
  hashtags: z.array(z.string().max(40)).max(20).default([]),
  imageIndex: z.number().int().min(0).optional().nullable(),
});
export type PostVariant = z.infer<typeof variantSchema>;

export const copywriterOutputSchema = z.object({ variants: z.array(variantSchema).min(1).max(20) });

export interface ProductBrief {
  name: string;
  tagline?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  playersMin?: number | null;
  playersMax?: number | null;
  durationMinutes?: number | null;
  pageCount?: number | null;
  priceLabel: string;
  kitContents: Array<{ title: string; quantity?: number | null }>;
  images: Array<{ index: number; alt: string | null; role: string }>;
  url: string;
  brandName: string;
}

export function buildCopywriterPrompt(brief: ProductBrief, channels: Channel[], variantsPerChannel = 3): string {
  const facts = [
    `Nom : ${brief.name}`,
    brief.tagline ? `Promesse : ${brief.tagline}` : null,
    brief.shortDescription ? `Description : ${brief.shortDescription}` : null,
    brief.ageMin || brief.ageMax ? `Âge : ${brief.ageMin ?? "?"}–${brief.ageMax ?? "?"} ans` : null,
    brief.playersMin || brief.playersMax ? `Joueurs : ${brief.playersMin ?? "?"} à ${brief.playersMax ?? "?"}` : null,
    brief.durationMinutes ? `Durée : ${brief.durationMinutes} min` : null,
    brief.pageCount ? `Pages : ${brief.pageCount} (PDF à imprimer)` : null,
    `Prix : ${brief.priceLabel}`,
    brief.kitContents.length ? `Contenu du kit : ${brief.kitContents.map((k) => (k.quantity ? `${k.quantity} × ${k.title}` : k.title)).join(" ; ")}` : null,
    `Lien (déjà tracé) : ${brief.url}`,
    `Marque : ${brief.brandName}`,
    brief.images.length ? `Images disponibles (index → description) : ${brief.images.map((i) => `${i.index} → ${i.alt ?? i.role}`).join(" ; ")}` : "Aucune image décrite",
  ].filter(Boolean).join("\n");

  const rules = channels.map((c) => {
    const l = LIMITS[c];
    const extra = c === "meta_ad" ? ` ; "headline" obligatoire ≤ ${l.headline} caractères ; pas de hashtags` : c === "tiktok" ? " ; ton oral, très court, 3 à 8 hashtags populaires FR" : c === "instagram" ? " ; 8 à 15 hashtags pertinents FR, emojis sobres, retours à la ligne autorisés" : " ; ton chaleureux, phrases courtes, 0 à 5 hashtags";
    return `- ${c} : ${variantsPerChannel} variantes, "hook" ≤ ${l.hook} caractères, "body" ≤ ${l.body} caractères${extra}`;
  }).join("\n");

  return `Tu es un rédacteur publicitaire francophone spécialisé dans les produits pour familles (parents d'enfants de 3 à 10 ans). Rédige des publications sociales pour le produit numérique ci-dessous.

FAITS (seule source autorisée) :
${facts}

RÈGLES ABSOLUES :
- N'invente AUCUN fait : pas de chiffres de ventes, pas d'avis ou de témoignages, pas de garantie, pas de prix barré, pas de « n°1 », pas de promesse non présente dans les faits.
- Pas de majuscules criardes, pas de point d'exclamation en rafale. Tutoiement ou vouvoiement cohérent par variante (vouvoiement par défaut).
- Chaque variante a un angle différent (ex. : gain de temps du parent, émotion de l'enfant, idée d'anniversaire, jour de pluie, fratrie qui joue ensemble).
- "cta" : appel à l'action court (ex. « Téléchargez le kit », « Découvrir l'aventure »). Le lien est ajouté automatiquement : ne le recopie pas dans le texte.
- "imageIndex" : index de l'image la plus adaptée parmi celles listées, ou null.
- "label" : nom court de l'angle (ex. « Jour de pluie »).

FORMATS DEMANDÉS :
${rules}

RÉPONDS UNIQUEMENT avec un JSON valide, sans texte autour, de la forme :
{"variants":[{"channel":"instagram","label":"…","hook":"…","body":"…","cta":"…","headline":null,"hashtags":["#…"],"imageIndex":0}]}`;
}

/** Retire les blocs \`\`\`json et extrait le premier objet JSON. */
export function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("Aucun objet JSON trouvé dans la réponse");
  return t.slice(start, end + 1);
}

export function parseCopywriterOutput(text: string): PostVariant[] {
  const parsed = copywriterOutputSchema.parse(JSON.parse(extractJson(text)));
  return parsed.variants.map((v) => ({ ...v, hashtags: (v.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, "")) }));
}

/** Texte complet prêt à publier (corps + CTA + hashtags) pour un canal. */
export function composePostText(v: { hook?: string | null; body: string; cta?: string | null; hashtags: string[]; linkUrl?: string | null }, channel: Channel | string): string {
  const parts = [v.hook, v.body, v.cta].filter(Boolean) as string[];
  let text = parts.join("\n\n");
  if (channel === "facebook" && v.linkUrl) text += `\n\n${v.linkUrl}`;
  if (channel === "instagram" && v.linkUrl) text += "\n\n👉 Lien dans la bio";
  if (v.hashtags.length) text += `\n\n${v.hashtags.join(" ")}`;
  return text;
}
