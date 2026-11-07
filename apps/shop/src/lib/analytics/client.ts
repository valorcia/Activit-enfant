"use client";

/**
 * Suivi d'événements côté client. Les pixels ne sont chargés qu'après
 * consentement ; les appels sont ignorés si les scripts sont absents.
 */
type Params = Record<string, string | number | boolean | undefined | null | Array<Record<string, unknown>>>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    pintrk?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackEvent(name: string, params: Params = {}) {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", name, params);
    if (window.fbq) {
      const map: Record<string, string> = { add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase", view_item: "ViewContent", sign_up: "Lead" };
      const fbName = map[name];
      if (fbName) window.fbq("track", fbName, { value: params.value, currency: params.currency, content_name: params.item_name });
    }
    if (window.pintrk && name === "purchase") window.pintrk("track", "checkout", { value: params.value, currency: params.currency });
  } catch {
    /* ignoré */
  }
}

export const CONSENT_COOKIE = "cc-consent";
export type ConsentState = { analytics: boolean; marketing: boolean; decidedAt: string };

export function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])) as ConsentState; } catch { return null; }
}

export function writeConsent(state: Omit<ConsentState, "decidedAt">) {
  const value = encodeURIComponent(JSON.stringify({ ...state, decidedAt: new Date().toISOString() }));
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 180}; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent("cc-consent-change"));
}
