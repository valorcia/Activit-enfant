/**
 * Limitation de débit en mémoire (par instance), sur le modèle des actions publiques existantes.
 * Clés sans donnée personnelle en clair : l'adresse e-mail est hachée avant d'être utilisée.
 * Limite connue : non partagée entre instances serverless (voir STORE_UNWRITTEN.md).
 */
import { sha256 } from "@/lib/tokens";

const buckets = new Map<string, { count: number; reset: number }>();

export const LIMITS = {
  /** Sauvegardes du questionnaire par adresse IP. */
  questionnaireIp: { max: 120, windowMs: 15 * 60_000 },
  /** Création de brouillons par adresse IP. */
  draftCreateIp: { max: 20, windowMs: 60 * 60_000 },
  /** Envoi de liens magiques : par adresse e-mail et par IP. */
  magicLinkEmail: { max: 3, windowMs: 60 * 60_000 },
  magicLinkIp: { max: 10, windowMs: 60 * 60_000 },
  /** Ouverture de liens (reprise, cadeau) par IP. */
  tokenIp: { max: 30, windowMs: 15 * 60_000 },
  /** Démarrage d'un paiement par IP. */
  checkoutIp: { max: 10, windowMs: 15 * 60_000 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Vrai si la limite est dépassée (et compte la tentative). */
export function rateLimited(name: LimitName, key: string, now = Date.now()): boolean {
  if (!key) return false;
  const { max, windowMs } = LIMITS[name];
  const id = `${name}:${key}`;
  const cur = buckets.get(id);
  if (!cur || cur.reset < now) {
    buckets.set(id, { count: 1, reset: now + windowMs });
    return false;
  }
  cur.count += 1;
  return cur.count > max;
}

export function emailKey(email: string): string {
  return sha256(`rl:${email.trim().toLowerCase()}`).slice(0, 32);
}

export function resetRateLimits() {
  buckets.clear();
}
