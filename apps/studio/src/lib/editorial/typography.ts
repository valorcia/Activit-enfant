/**
 * Microtypographie par langue : guillemets, apostrophes, tirets, points de suspension,
 * espaces fines insécables du français. Appliquée à tout texte avant composition.
 * Règles détaillées : docs/unwritten/DESIGN_SYSTEM_UNWRITTEN.md § 6.
 */
import type { ProseRun } from "../schemas/layout";

export type EditorialLang = "fr" | "en";

/** Espace fine insécable (U+202F) */
export const NNBSP = " ";
/** Espace insécable (U+00A0) */
export const NBSP = " ";

const OPENING_CONTEXT = /[\s([{—–  -]/;

function curlyQuotes(text: string, open: string, close: string, sOpen: string, sClose: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const prev = i === 0 ? " " : text[i - 1];
    if (ch === '"') out += OPENING_CONTEXT.test(prev) ? open : close;
    else if (ch === "'") out += OPENING_CONTEXT.test(prev) && /\w/.test(text[i + 1] ?? "") && sOpen !== sClose ? sOpen : sClose;
    else out += ch;
  }
  return out;
}

/** Typographie anglaise : “guillemets”, ’apostrophes’, tiret cadratin, points de suspension. */
export function typesetEn(text: string): string {
  let t = text.replace(/\.\.\./g, "…").replace(/\s?--\s?/g, "—");
  t = curlyQuotes(t, "“", "”", "‘", "’");
  return t.replace(/ {2,}/g, " ");
}

/**
 * Typographie française (Lexique des règles typographiques en usage à l'Imprimerie nationale,
 * adapté) : espace fine insécable avant ; ! ? et à l'intérieur des guillemets « », espace
 * insécable avant les deux-points, apostrophe typographique, tiret de dialogue suivi d'une insécable.
 */
export function typesetFr(text: string): string {
  let t = text.replace(/\.\.\./g, "…").replace(/\s?--\s?/g, " — ");
  // Guillemets droits doubles → « … »
  let open = true;
  t = t.replace(/"/g, () => {
    const q = open ? "«" : "»";
    open = !open;
    return q;
  });
  t = t.replace(/'/g, "’");
  // Espaces autour des guillemets français
  t = t.replace(/«[\s  ]*/g, `«${NNBSP}`).replace(/[\s  ]*»/g, `${NNBSP}»`);
  // Ponctuation haute
  t = t.replace(/[   ]*([;!?])/g, `${NNBSP}$1`).replace(/([^\d\s])[   ]*:(?![\/\d])/g, `$1${NBSP}:`);
  // Un « !? » ne prend qu'une espace
  t = t.replace(new RegExp(`([!?])${NNBSP}([!?])`, "g"), "$1$2");
  // Tiret de dialogue en début de paragraphe
  t = t.replace(/^[—–-]\s+/, `—${NBSP}`);
  // Nombre et unité ou pourcentage
  t = t.replace(/(\d) (%|€|\$|h\b|min\b|km\b|kg\b|ans\b)/g, `$1${NNBSP}$2`);
  return t.replace(/ {2,}/g, " ");
}

export function typeset(text: string, lang: EditorialLang): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return lang === "fr" ? typesetFr(clean) : typesetEn(clean);
}

/**
 * Découpe un paragraphe en segments : `*mot*` ou `_mot_` passe en italique.
 * La typographie est appliquée à chaque segment.
 */
export function parseInline(text: string, lang: EditorialLang): ProseRun[] {
  const runs: ProseRun[] = [];
  const re = /(\*[^*]+\*|_[^_]+_)/g;
  const typed = typeset(text, lang);
  let last = 0;
  for (const m of typed.matchAll(re)) {
    if (m.index! > last) runs.push({ t: typed.slice(last, m.index) });
    runs.push({ t: m[0].slice(1, -1), i: true });
    last = m.index! + m[0].length;
  }
  if (last < typed.length) runs.push({ t: typed.slice(last) });
  return runs.filter((r) => r.t.length > 0);
}

/** Texte brut d'une suite de segments. */
export function runsText(runs: ProseRun[]): string {
  return runs.map((r) => r.t).join("");
}

/** Extrait les caractères [from, to) d'une suite de segments, en conservant leurs styles. */
export function sliceRuns(runs: ProseRun[], from: number, to: number): ProseRun[] {
  const out: ProseRun[] = [];
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.t.length;
    const a = Math.max(from, pos);
    const b = Math.min(to, end);
    if (b > a) out.push({ ...r, t: r.t.slice(a - pos, b - pos) });
    pos = end;
  }
  return out;
}

/** Passe les `n` premiers mots en capitales espacées (attaque de chapitre). */
export function leadInRuns(runs: ProseRun[], words: number): ProseRun[] {
  if (words <= 0 || runs.length === 0) return runs;
  const text = runsText(runs);
  const re = /\S+/g;
  let end = 0;
  for (let k = 0; k < words; k++) {
    const m = re.exec(text);
    if (!m) break;
    end = m.index + m[0].length;
  }
  if (end === 0) return runs;
  const head = sliceRuns(runs, 0, end).map((r) => ({ ...r, sc: true }));
  return [...head, ...sliceRuns(runs, end, text.length)];
}
