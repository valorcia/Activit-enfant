/**
 * Rédaction par lots des livres à grand volume (fonctions pures, testables).
 *
 * Au-delà de BATCH_THRESHOLD éléments, un seul appel IA risque d'être tronqué (limite de
 * sortie). On procède donc en trois temps :
 *  1. un SOMMAIRE (titres + idée) de tous les éléments — court, fiable, il évite les doublons ;
 *  2. le CADRE du livre (lettres, guide, fiche boutique…) avec le premier lot d'éléments ;
 *  3. les LOTS suivants (éléments seulement), indépendants les uns des autres : ils peuvent
 *     être lancés en parallèle (API) ou collés dans n'importe quel ordre (copier-coller).
 * Chaque lot validé est conservé (Book.kitDraft) : une reprise ne relance que les lots manquants.
 */
import { createHash } from "node:crypto";
import { BATCH_SIZE, BATCH_THRESHOLD } from "./limits";
import { ITEMS_KEY, type KitContentFormat } from "./schemas";

export interface OutlineEntry {
  numero: number;
  titre: string;
  idee?: string;
}

export interface BatchRange {
  index: number;
  from: number; // numéro du premier élément (1-based)
  to: number; // numéro du dernier élément (inclus)
}

export function needsBatching(count: number, threshold = BATCH_THRESHOLD): boolean {
  return count > threshold;
}

/** Découpe 1..count en lots de `size` (le dernier lot trop petit est fusionné avec le précédent). */
export function planBatches(count: number, size = BATCH_SIZE): BatchRange[] {
  const out: BatchRange[] = [];
  for (let from = 1, i = 0; from <= count; from += size, i++) out.push({ index: i, from, to: Math.min(count, from + size - 1) });
  if (out.length > 1) {
    const last = out[out.length - 1];
    if (last.to - last.from + 1 < Math.ceil(size / 3)) {
      out.pop();
      out[out.length - 1].to = last.to;
    }
  }
  return out;
}

/** Titre normalisé (comparaison des doublons) : minuscules, sans accents ni ponctuation, sans article initial. */
export function normalizeTitle(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/^(le|la|les|l|un|une|des|du|de) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Titre d'un élément quel que soit le format (la chasse au trésor se distingue par sa cachette). */
export function itemTitle(format: KitContentFormat, item: Record<string, unknown>): string {
  if (format === "treasure_hunt") return String(item.cachette ?? item.texte ?? "");
  return String(item.titre ?? "");
}

/** Sommaire : renumérote, retire les doublons et tronque au nombre demandé. */
export function cleanOutline(entries: OutlineEntry[], count: number): OutlineEntry[] {
  const seen = new Set<string>();
  const out: OutlineEntry[] = [];
  for (const e of entries) {
    const k = normalizeTitle(e.titre);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ numero: out.length + 1, titre: e.titre.trim(), idee: e.idee?.trim() || undefined });
    if (out.length >= count) break;
  }
  return out;
}

/**
 * Fusion des lots : concatène dans l'ordre, supprime les doublons (même titre normalisé),
 * renumérote de 1 à n. Renvoie aussi le nombre d'éléments manquants pour atteindre `count`.
 */
export function mergeBatchItems<T extends Record<string, unknown>>(format: KitContentFormat, batches: T[][], count: number): { items: T[]; duplicates: number; missing: number } {
  const seen = new Set<string>();
  const items: T[] = [];
  let duplicates = 0;
  for (const batch of batches) {
    for (const it of batch) {
      const k = normalizeTitle(itemTitle(format, it));
      if (k && seen.has(k)) {
        duplicates++;
        continue;
      }
      if (k) seen.add(k);
      if (items.length < count) items.push({ ...it, numero: items.length + 1 });
    }
  }
  return { items, duplicates, missing: Math.max(0, count - items.length) };
}

/** Assemble le contenu final : le cadre (premier lot) avec la liste complète des éléments. */
export function assembleContent<C extends Record<string, unknown>>(format: KitContentFormat, frame: C, items: Array<Record<string, unknown>>): C {
  return { ...frame, [ITEMS_KEY[format]]: items };
}

/** Brouillon de rédaction par lots (Book.kitDraft). */
export interface KitDraft {
  key: string;
  outline?: OutlineEntry[];
  frame?: Record<string, unknown>;
  /** Lots d'éléments validés, indexés par index de lot (le lot 0 est inclus dans le cadre) */
  batches: Record<string, Array<Record<string, unknown>>>;
}

/** Empreinte du brouillon : un changement de format, de nombre ou de titre repart de zéro. */
export function draftKey(o: { format: KitContentFormat; count: number; title: string; ageRange: string }): string {
  return createHash("sha1").update(JSON.stringify([o.format, o.count, o.title, o.ageRange])).digest("hex").slice(0, 16);
}

export function readDraft(raw: unknown, key: string): KitDraft {
  const d = raw as Partial<KitDraft> | null;
  if (d && d.key === key && typeof d.batches === "object" && d.batches) return { key, outline: d.outline, frame: d.frame, batches: d.batches as KitDraft["batches"] };
  return { key, batches: {} };
}

/** Exécute des tâches avec une concurrence bornée ; les erreurs sont collectées (aucune tâche n'interrompt les autres). */
export async function runPool<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<Array<{ ok: true; value: T } | { ok: false; error: unknown }>> {
  const results: Array<{ ok: true; value: T } | { ok: false; error: unknown }> = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { ok: true, value: await tasks[i]() };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length)) }, worker));
  return results;
}
