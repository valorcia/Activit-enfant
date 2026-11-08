"use client";
import { UTM_STORAGE_KEY, UTM_TTL_DAYS } from "@/lib/social/attribution";

type Stored = { utm: Record<string, string>; at: number };

function readStored(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (Date.now() - parsed.at > UTM_TTL_DAYS * 86400_000) { localStorage.removeItem(UTM_STORAGE_KEY); return null; }
    return parsed.utm;
  } catch { return null; }
}

/** Mémorise les UTM du premier contact (30 jours) ; ne les écrase pas si déjà présents. */
export function captureUtmFromLocation(): void {
  if (typeof window === "undefined") return;
  const fromUrl = Object.fromEntries([...new URLSearchParams(window.location.search).entries()].filter(([k]) => k.startsWith("utm_")));
  if (Object.keys(fromUrl).length === 0) return;
  try {
    if (readStored()) return; // attribution au premier contact
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify({ utm: fromUrl, at: Date.now() } satisfies Stored));
  } catch { /* stockage indisponible */ }
}

/** UTM à joindre au paiement : ceux de l'URL courante, sinon ceux mémorisés. */
export function currentUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const fromUrl = Object.fromEntries([...new URLSearchParams(window.location.search).entries()].filter(([k]) => k.startsWith("utm_")));
  if (Object.keys(fromUrl).length) return fromUrl;
  return readStored() ?? {};
}
