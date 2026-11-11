/**
 * Limites techniques des e-books à grand volume (cahier de coloriage de 120 dessins,
 * recueil de 200 recettes…). Il n'y a plus de plafond « éditorial » sur le nombre
 * d'éléments ou d'images : seule cette borne haute protège la plateforme (mémoire du
 * rendu PDF, taille des fichiers, durée d'un run) et elle est volontairement large.
 *
 * Pour aller au-delà, augmentez MAX_ITEMS_PER_BOOK : tout le studio (schémas, formulaires,
 * plan depuis un brief, import JSON) lit cette constante unique.
 */

/** Nombre maximal d'éléments principaux (énigmes, idées, chapitres, recettes, expériences, dessins) par livre — et donc d'illustrations d'éléments. */
export const MAX_ITEMS_PER_BOOK = 500;

/** Au-delà de ce nombre d'éléments, le texte est rédigé par lots (un seul appel risquerait d'être tronqué). */
export const BATCH_THRESHOLD = 20;

/** Taille d'un lot de rédaction (15 à 20 éléments : sortie confortable pour Claude comme pour GPT). */
export const BATCH_SIZE = 15;

/** Livres plus longs que ce nombre de pages : rendu PDF par tranches puis fusion (pdf-lib). */
export const PDF_CHUNK_THRESHOLD = 40;

/** Pages rendues par tranche PDF. */
export const PDF_CHUNK_PAGES = 30;

/** Délai de rendu PDF : base + supplément par page (proportionnel à la taille du livre). */
export function pdfTimeoutMs(pages: number): number {
  return 60_000 + Math.max(0, pages) * 3_000;
}

/** Borne un nombre d'éléments demandé dans [1, MAX_ITEMS_PER_BOOK]. */
export function clampItemCount(n: unknown, fallback = 10): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, v));
}
