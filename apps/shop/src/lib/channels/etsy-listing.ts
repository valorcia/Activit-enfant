/**
 * Construction d'une fiche Etsy à partir d'une fiche produit de la boutique.
 * Fonctions pures (sans accès réseau ni base) : testées dans tests/etsy.test.ts.
 *
 * Contraintes Etsy appliquées : titre ≤ 140 caractères, 13 mots-clés maximum de
 * 20 caractères chacun, description en texte brut, produit numérique (type
 * « download »), mention de l'usage de l'IA configurable.
 */
import type { EtsySettings } from "@/lib/schemas/settings";

export const ETSY_TITLE_MAX = 140;
export const ETSY_TAG_MAX = 13;
export const ETSY_TAG_LENGTH = 20;
export const ETSY_MAX_IMAGES = 10;
export const ETSY_MAX_FILES = 5;
export const ETSY_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ETSY_QUANTITY = 999;

export interface EtsyKitItem { title: string; description?: string | null; quantity?: number | null }

export interface EtsySourceProduct {
  name: string;
  tagline?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  story?: string | null;
  kitContents?: EtsyKitItem[];
  ageMin?: number | null;
  ageMax?: number | null;
  playersMin?: number | null;
  playersMax?: number | null;
  durationMinutes?: number | null;
  pageCount?: number | null;
  fileFormat?: string | null;
  materials?: string[];
  keywords?: string[];
  tags?: string[];
  universe?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  template?: string | null;
  priceCents: number;
  siteName?: string | null;
}

export interface EtsyOverrides { title?: string | null; description?: string | null; tags?: string[] | null; priceCents?: number | null }

export interface EtsyListingDraft {
  title: string;
  description: string;
  tags: string[];
  priceCents: number;
  taxonomyId: number | null;
  whoMade: EtsySettings["whoMade"];
  whenMade: string;
  autoRenew: boolean;
}

const PLACEHOLDER = /\[(À|A) COMPL[ÉE]TER\]|\[EXEMPLE\]|\[À CONFIRMER\]/i;

/** Markdown → texte brut lisible (Etsy n'interprète pas le markdown). */
export function markdownToPlainText(md: string | null | undefined): string {
  if (!md) return "";
  let s = md.replace(/\r\n?/g, "\n");
  s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, ""));
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "");                    // images
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");                  // liens → texte
  s = s.replace(/^\s{0,3}#{1,6}\s*(.+?)\s*#*\s*$/gm, (_, t: string) => t.toUpperCase()); // titres → MAJUSCULES
  s = s.replace(/^\s*[-*+]\s+/gm, "• ");                            // puces
  s = s.replace(/^\s*>\s?/gm, "");                                  // citations
  s = s.replace(/(\*\*|__)(.+?)\1/g, "$2");                         // gras
  s = s.replace(/(\*|_)(\S(?:.*?\S)?)\1/g, "$2");                   // italique
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function clean(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  return PLACEHOLDER.test(t) ? "" : t;
}

/** Caractères refusés par Etsy dans les titres. */
function sanitizeTitlePart(s: string): string {
  return s.replace(/[\^$`~{}<>|\\]/g, " ").replace(/\s+/g, " ").trim();
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function ageLabel(min?: number | null, max?: number | null): string | null {
  if (min && max) return `${min}-${max} ans`;
  if (min) return `dès ${min} ans`;
  if (max) return `jusqu'à ${max} ans`;
  return null;
}

/**
 * Titre optimisé pour la recherche Etsy : mots-clés principaux en tête, tranche
 * d'âge, mention « à imprimer », nom du produit en dernier. Segments séparés
 * par « | », sans doublon, coupé à une frontière de segment (≤ 140).
 */
export function buildEtsyTitle(p: EtsySourceProduct): string {
  const keywords = (p.keywords ?? []).map((k) => clean(k)).filter(Boolean);
  const age = ageLabel(p.ageMin, p.ageMax);
  const primary = keywords[0] ? capitalize(keywords[0]) : p.categoryName ? capitalize(p.categoryName) : null;
  const segments: string[] = [];
  if (primary) segments.push(age && !primary.includes(age) ? `${primary} ${age}` : primary);
  for (const k of keywords.slice(1, 3)) segments.push(capitalize(k));
  const all = [...segments].join(" ").toLowerCase();
  if (!/imprim|pdf|printable/.test(all)) segments.push("PDF à imprimer");
  if (!primary && age) segments.push(age);
  segments.push(p.name);

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of segments) {
    const part = sanitizeTitlePart(raw);
    const key = part.toLowerCase();
    if (!part || seen.has(key)) continue;
    // Ignore un segment entièrement contenu dans un segment déjà retenu
    if (parts.some((x) => x.toLowerCase().includes(key))) continue;
    seen.add(key);
    parts.push(part);
  }
  // Le nom du produit doit figurer : on retire des segments intermédiaires si nécessaire
  let title = parts.join(" | ");
  while (title.length > ETSY_TITLE_MAX && parts.length > 2) {
    parts.splice(parts.length - 2, 1);
    title = parts.join(" | ");
  }
  if (title.length > ETSY_TITLE_MAX) title = title.slice(0, ETSY_TITLE_MAX).replace(/\s+\S*$/, "").trim();
  return title;
}

function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ") // Etsy : lettres, chiffres, espaces, tiret, apostrophe
    .replace(/\s+/g, " ")
    .trim();
}

/** Raccourcit un mot-clé trop long en retirant des mots en fin (≤ 20 caractères). */
function fitTag(tag: string): string | null {
  if (tag.length <= ETSY_TAG_LENGTH) return tag;
  const words = tag.split(" ");
  while (words.length > 1 && words.join(" ").length > ETSY_TAG_LENGTH) words.pop();
  const fitted = words.join(" ");
  return fitted.length <= ETSY_TAG_LENGTH && fitted.length >= 3 ? fitted : null;
}

const TEMPLATE_TAGS: Record<string, string[]> = {
  ADVENTURE: ["chasse au tresor", "jeu a imprimer", "anniversaire enfant", "jeu enfant", "activite enfant"],
  EVENT: ["fete enfant", "jeu a imprimer", "anniversaire enfant", "activite enfant"],
  ACTIVITY: ["activite enfant", "cahier activites", "jeu educatif", "a imprimer"],
  STORY: ["histoire enfant", "livre numerique", "conte a imprimer"],
  GUIDE: ["guide pratique", "ebook pdf", "guide pdf"],
  RECIPES: ["livre de recettes", "recettes pdf", "ebook cuisine"],
  CLASSIC: ["a imprimer", "pdf telechargeable"],
};

/** 13 mots-clés Etsy (≤ 20 caractères, sans doublon) issus des mots-clés, tags, univers et catégorie. */
export function buildEtsyTags(p: EtsySourceProduct): string[] {
  const age = p.ageMin && p.ageMax ? `${p.ageMin} ${p.ageMax} ans` : null;
  const candidates = [
    ...(p.keywords ?? []),
    ...(p.tags ?? []),
    p.universe ?? "",
    p.categoryName ?? "",
    age ? `enfant ${age}` : "",
    ...(TEMPLATE_TAGS[p.template ?? "CLASSIC"] ?? TEMPLATE_TAGS.CLASSIC),
    "pdf a imprimer",
    "telechargement",
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    if (!raw || PLACEHOLDER.test(raw)) continue;
    const t = fitTag(normalizeTag(raw));
    if (!t) continue;
    const key = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= ETSY_TAG_MAX) break;
  }
  return out;
}

/** Prix Etsy : prix boutique majoré, arrondi à ,90 ou ,99 (au-dessus). */
export function computeEtsyPriceCents(priceCents: number, markupPercent = 0, rounding: EtsySettings["rounding"] = "90"): number {
  const raw = Math.round(priceCents * (1 + Math.max(0, markupPercent) / 100));
  if (rounding === "none") return Math.max(20, raw);
  const ending = rounding === "99" ? 99 : 90;
  if (raw % 100 === ending) return raw;
  let target = Math.floor(raw / 100) * 100 + ending;
  if (target < raw) target += 100;
  return Math.max(20, target);
}

function practicalLines(p: EtsySourceProduct): string[] {
  const lines: string[] = [];
  const age = ageLabel(p.ageMin, p.ageMax);
  if (age) lines.push(`• Âge conseillé : ${age}`);
  if (p.playersMin || p.playersMax) {
    const pl = p.playersMin && p.playersMax ? `${p.playersMin} à ${p.playersMax}` : `${p.playersMin ?? p.playersMax}`;
    lines.push(`• Nombre d'enfants : ${pl}`);
  }
  if (p.durationMinutes) lines.push(`• Durée : environ ${p.durationMinutes} minutes`);
  if (p.pageCount) lines.push(`• ${p.pageCount} pages au format ${p.fileFormat || "PDF"}`);
  else if (p.fileFormat) lines.push(`• Format : ${p.fileFormat}`);
  const materials = (p.materials ?? []).map(clean).filter(Boolean);
  if (materials.length) lines.push(`• Matériel : ${materials.join(", ")}`);
  return lines;
}

const DESCRIPTION_MAX = 9000;

/** Description Etsy en texte brut, structurée en sections. */
export function buildEtsyDescription(p: EtsySourceProduct, settings: Pick<EtsySettings, "aiDisclosureEnabled" | "aiDisclosureText">): string {
  const blocks: string[] = [];
  const hook = clean(p.tagline);
  if (hook) blocks.push(hook);
  const short = clean(p.shortDescription);
  if (short) blocks.push(short);

  const story = clean(markdownToPlainText(p.story));
  if (story) blocks.push(story);

  const kit = (p.kitContents ?? []).filter((k) => clean(k.title));
  if (kit.length) {
    blocks.push(["CE QUE CONTIENT LE KIT", ...kit.map((k) => {
      const qty = k.quantity && k.quantity > 1 ? ` (x${k.quantity})` : "";
      const desc = clean(k.description);
      return `• ${k.title}${qty}${desc ? ` : ${desc}` : ""}`;
    })].join("\n"));
  }

  const practical = practicalLines(p);
  if (practical.length) blocks.push(["INFOS PRATIQUES", ...practical].join("\n"));

  const long = clean(markdownToPlainText(p.longDescription));
  if (long) blocks.push(long);

  blocks.push([
    "COMMENT ÇA MARCHE",
    "1. Après votre achat, téléchargez le fichier depuis votre compte Etsy (rubrique « Achats ») ou depuis l'email de confirmation.",
    "2. Imprimez chez vous, en couleur ou en noir et blanc, sur du papier A4.",
    "3. Préparez, jouez… et amusez-vous !",
  ].join("\n"));

  blocks.push([
    "PRODUIT NUMÉRIQUE : aucun objet physique ne sera envoyé.",
    "Les couleurs peuvent légèrement varier selon votre écran et votre imprimante.",
    "Usage personnel et familial uniquement : la revente et la redistribution des fichiers sont interdites.",
  ].join("\n"));

  if (settings.aiDisclosureEnabled && settings.aiDisclosureText.trim()) blocks.push(settings.aiDisclosureText.trim());
  if (p.siteName) blocks.push(`Merci de votre visite ! ${p.siteName}`);

  let text = blocks.join("\n\n");
  if (text.length > DESCRIPTION_MAX) text = text.slice(0, DESCRIPTION_MAX).replace(/\s+\S*$/, "") + "…";
  return text;
}

/** Catégorie Etsy : correspondance par catégorie de la boutique, sinon valeur par défaut. */
export function resolveTaxonomyId(categorySlug: string | null | undefined, settings: Pick<EtsySettings, "taxonomyByCategory" | "defaultTaxonomyId">): number | null {
  if (categorySlug && settings.taxonomyByCategory[categorySlug]) return settings.taxonomyByCategory[categorySlug];
  return settings.defaultTaxonomyId ?? null;
}

/** Fiche Etsy complète (valeurs générées, puis surcharges saisies dans l'admin). */
export function buildEtsyListing(p: EtsySourceProduct, settings: EtsySettings, overrides: EtsyOverrides | null = null): EtsyListingDraft {
  const tags = overrides?.tags?.length ? overrides.tags.map((t) => fitTag(normalizeTag(t))).filter((t): t is string => !!t).slice(0, ETSY_TAG_MAX) : buildEtsyTags(p);
  const title = overrides?.title?.trim() ? sanitizeTitlePart(overrides.title).slice(0, ETSY_TITLE_MAX) : buildEtsyTitle(p);
  return {
    title,
    description: overrides?.description?.trim() ? overrides.description.trim() : buildEtsyDescription(p, settings),
    tags,
    priceCents: overrides?.priceCents && overrides.priceCents > 0 ? overrides.priceCents : computeEtsyPriceCents(p.priceCents, settings.markupPercent, settings.rounding),
    taxonomyId: resolveTaxonomyId(p.categorySlug, settings),
    whoMade: settings.whoMade,
    whenMade: settings.whenMade,
    autoRenew: settings.autoRenew,
  };
}

/**
 * Frais Etsy estimés pour une vente, en centimes : commission + frais de paiement,
 * et, si `listingFeeCents` est fourni, le renouvellement automatique de 0,20 $ facturé
 * par article vendu sur une fiche à quantité multiple.
 */
export function estimateEtsyFeesCents(grossCents: number, settings: Pick<EtsySettings, "transactionFeePercent" | "paymentFeePercent" | "paymentFeeFixedCents"> & { listingFeeCents?: number }, quantity = 1): number {
  if (grossCents <= 0) return 0;
  return Math.round(grossCents * (settings.transactionFeePercent + settings.paymentFeePercent) / 100) + settings.paymentFeeFixedCents + (settings.listingFeeCents ?? 0) * Math.max(1, quantity);
}

/** Montant Etsy { amount, divisor } → centimes. */
export function etsyMoneyToCents(m: { amount: number; divisor: number } | null | undefined): number {
  if (!m || !m.divisor) return 0;
  return Math.round((m.amount * 100) / m.divisor);
}

/** Empreinte stable d'une liste de sources (images ou fichiers) pour ne renvoyer que ce qui a changé. */
export function sourcesHash(sources: string[]): string {
  let h = 2166136261;
  const s = sources.join("\n");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + ":" + sources.length;
}
