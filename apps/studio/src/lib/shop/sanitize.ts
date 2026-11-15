/**
 * Mise aux normes de la fiche produit avant envoi à la boutique : les textes rédigés par l'IA
 * dépassent parfois les limites de l'API (mots-clés de plus de 80 caractères, question de FAQ
 * trop longue, difficulté hors bornes…) et la boutique refuse alors toute la fiche
 * (« Données invalides »). Les limites reprennent celles de apps/shop/src/lib/schemas/product.ts.
 */

function clip(text: unknown, max: number): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

function clipLong(text: unknown, max: number): string {
  const t = String(text ?? "").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Liste de libellés courts : vides retirés, doublons retirés, 80 caractères et 50 éléments au plus. */
function labels(list: unknown, max = 50): string[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const out: string[] = [];
  for (const v of list) {
    const s = clip(v, 80);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function int(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function opt(v: string): string | undefined {
  return v ? v : undefined;
}

export function sanitizeListing<T extends Record<string, unknown>>(listing: T): T {
  const l: Record<string, unknown> = { ...listing };
  if (l.name !== undefined) l.name = clip(l.name, 160) || "E-book";
  if (typeof l.slug === "string") l.slug = l.slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 96) || undefined;
  for (const [k, max] of [["tagline", 200], ["shortDescription", 400], ["universe", 80], ["seoTitle", 70], ["seoDescription", 170], ["promoText", 300], ["fileFormat", 40]] as const) {
    if (typeof l[k] === "string") l[k] = opt(clip(l[k], max));
  }
  for (const k of ["longDescription", "story"] as const) if (typeof l[k] === "string") l[k] = opt(clipLong(l[k], 20000));
  for (const k of ["tags", "badges", "heroBadges", "materials", "keywords"] as const) if (l[k] !== undefined) l[k] = labels(l[k]);
  for (const k of ["ageMin", "ageMax", "playersMin", "playersMax", "durationMinutes", "pageCount", "priceCents", "salePriceCents", "creationCostCents"] as const) {
    if (l[k] !== undefined && l[k] !== null) l[k] = int(l[k], 0, 1_000_000);
  }
  if (l.difficulty !== undefined && l.difficulty !== null) l.difficulty = int(l.difficulty, 1, 5);
  if (typeof l.ageMin === "number" && typeof l.ageMax === "number" && l.ageMin > l.ageMax) [l.ageMin, l.ageMax] = [l.ageMax, l.ageMin];
  if (typeof l.playersMin === "number" && typeof l.playersMax === "number" && l.playersMin > l.playersMax) [l.playersMin, l.playersMax] = [l.playersMax, l.playersMin];
  if (typeof l.salePriceCents === "number" && typeof l.priceCents === "number" && l.salePriceCents >= l.priceCents) delete l.salePriceCents;

  if (Array.isArray(l.kitContents)) {
    l.kitContents = (l.kitContents as Array<Record<string, unknown>>)
      .map((i) => ({ title: clip(i?.title, 120), description: clip(i?.description, 400), icon: clip(i?.icon || "file-text", 40), ...(int(i?.quantity, 0, 100000) !== undefined ? { quantity: int(i?.quantity, 0, 100000) } : {}) }))
      .filter((i) => i.title)
      .slice(0, 40);
  }
  if (Array.isArray(l.faq)) {
    l.faq = (l.faq as Array<Record<string, unknown>>)
      .map((q) => ({ question: clip(q?.question, 200), answer: clipLong(q?.answer, 2000) }))
      .filter((q) => q.question && q.answer)
      .slice(0, 20);
  }
  if (Array.isArray(l.sellingPoints)) {
    l.sellingPoints = (l.sellingPoints as Array<Record<string, unknown>>)
      .map((p) => ({ title: clip(p?.title, 120), description: clip(p?.description, 400), icon: clip(p?.icon || "sparkles", 40) }))
      .filter((p) => p.title)
      .slice(0, 12);
  }
  return l as T;
}

/** Résumé lisible des erreurs de validation renvoyées par la boutique (422). */
export function describeValidationDetails(details: unknown): string {
  if (!Array.isArray(details)) return "";
  const parts = details.slice(0, 4).map((d) => {
    const x = d as { path?: unknown; message?: unknown };
    const path = Array.isArray(x.path) ? x.path.join(".") : String(x.path ?? "");
    return `${path || "fiche"} : ${String(x.message ?? "valeur refusée")}`;
  });
  return parts.length ? ` (${parts.join(" ; ")}${details.length > 4 ? ` ; +${details.length - 4}` : ""})` : "";
}
