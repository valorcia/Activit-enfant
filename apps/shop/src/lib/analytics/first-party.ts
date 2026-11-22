"use client";
import { readConsent } from "./client";

/**
 * Mesure d'audience interne (voir src/lib/analytics/events.ts) : envoie au serveur de la boutique,
 * et à lui seul, les visites et les étapes du parcours d'achat. Rien n'est envoyé si le visiteur a
 * refusé la mesure d'audience dans le bandeau des cookies.
 */
const VISITOR_KEY = "cc-vid";
const SESSION_KEY = "cc-sid";
const VISITOR_DAYS = 395; // 13 mois
const SESSION_IDLE_MS = 30 * 60_000;

function rid() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

function allowed(): boolean {
  const c = readConsent();
  return !(c && c.analytics === false);
}

function visitorId(): string | undefined {
  try {
    const raw = localStorage.getItem(VISITOR_KEY);
    const cur = raw ? (JSON.parse(raw) as { id: string; exp: number }) : null;
    if (cur && cur.exp > Date.now()) return cur.id;
    const id = rid();
    localStorage.setItem(VISITOR_KEY, JSON.stringify({ id, exp: Date.now() + VISITOR_DAYS * 86400_000 }));
    return id;
  } catch {
    return undefined;
  }
}

/** Identifiant de visite ; `fresh` vaut vrai au début d'une nouvelle visite. */
function sessionId(): { id?: string; fresh: boolean } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const cur = raw ? (JSON.parse(raw) as { id: string; last: number }) : null;
    const now = Date.now();
    if (cur && now - cur.last < SESSION_IDLE_MS) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: cur.id, last: now }));
      return { id: cur.id, fresh: false };
    }
    const id = rid();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
    return { id, fresh: true };
  } catch {
    return { fresh: true };
  }
}

function send(body: Record<string, unknown>) {
  try {
    const json = JSON.stringify(body);
    if (navigator.sendBeacon?.("/api/t", new Blob([json], { type: "application/json" }))) return;
    void fetch("/api/t", { method: "POST", body: json, keepalive: true, headers: { "content-type": "application/json" } });
  } catch {
    /* ignoré */
  }
}

export function trackPageView(path: string) {
  if (typeof window === "undefined" || !allowed()) return;
  const s = sessionId();
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const [k, v] of params) if (k.startsWith("utm_")) utm[k] = v.slice(0, 120);
  if (params.has("fbclid")) utm.fbclid = "1";
  if (params.has("gclid")) utm.gclid = "1";
  // La source n'est retenue qu'au début de la visite (ou quand l'URL porte des paramètres de campagne)
  const withSource = s.fresh || Object.keys(utm).length > 0;
  send({ type: "page_view", path, vid: visitorId(), sid: s.id, ...(withSource ? { ref: document.referrer || undefined, utm } : {}) });
}

export function trackFunnelStep(type: "view_item" | "add_to_cart" | "begin_checkout", data: { productId?: string; value?: number } = {}) {
  if (typeof window === "undefined" || !allowed()) return;
  const s = sessionId();
  send({ type, productId: data.productId, value: data.value, vid: visitorId(), sid: s.id, path: window.location.pathname });
}
