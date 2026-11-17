import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { randomToken, sha256, signPayload, verifySignedPayload } from "@/lib/tokens";

/**
 * Jetons de la vitrine UNWRITTEN. Le secret est dérivé et propre à la vitrine : un jeton
 * de téléchargement, d'accès aux commandes ou de l'espace créatrices ne peut pas servir ici.
 *  - lien de reprise : « udraft:<draftId>:<émis à (ms)> », usage unique (refusé s'il a été
 *    émis avant la dernière reprise), expiration configurable ;
 *  - cookie des brouillons : « udrafts:<id>,<id>… » (5 au plus), signé, httpOnly ;
 *  - lien cadeau : jeton aléatoire dont seul le hachage est stocké (révocable par rotation).
 */

function unwrittenSecret(): string {
  const base = env.authSecret || env.downloadTokenSecret;
  return createHash("sha256").update(`unwritten:${base}`).digest("base64url");
}

/**
 * Jetons signés dans une URL : « . » est remplacé par « ~ » (caractère non réservé), car le proxy
 * traite un dernier segment contenant un point comme un fichier statique (pas de réécriture).
 */
export function toUrlToken(token: string): string {
  return token.replaceAll(".", "~");
}
export function fromUrlToken(value: string): string {
  return decodeURIComponent(value).replaceAll("~", ".");
}

export function createResumeToken(draftId: string, validitySeconds: number, now = Date.now()): string {
  return signPayload(`udraft:${draftId}:${now}`, Math.floor(now / 1000) + validitySeconds, unwrittenSecret());
}

export function verifyResumeToken(token: string, now = Date.now()): { draftId: string; issuedAt: number } | null {
  const payload = verifySignedPayload(token, unwrittenSecret(), Math.floor(now / 1000));
  const m = payload ? /^udraft:([a-z0-9]+):(\d+)$/i.exec(payload) : null;
  return m ? { draftId: m[1], issuedAt: Number(m[2]) } : null;
}

export const MAX_COOKIE_DRAFTS = 5;

export function signDraftsCookie(ids: string[], days: number, now = Date.now()): string {
  const list = [...new Set(ids)].filter((id) => /^[a-z0-9]+$/i.test(id)).slice(-MAX_COOKIE_DRAFTS);
  return signPayload(`udrafts:${list.join(",")}`, Math.floor(now / 1000) + days * 86400, unwrittenSecret());
}

export function readDraftsCookie(value: string | null | undefined, now = Date.now()): string[] {
  if (!value) return [];
  const payload = verifySignedPayload(value, unwrittenSecret(), Math.floor(now / 1000));
  if (!payload?.startsWith("udrafts:")) return [];
  return payload.slice("udrafts:".length).split(",").filter(Boolean);
}

export function newGiftToken(): { token: string; hash: string } {
  const token = randomToken(32);
  return { token, hash: sha256(`gift:${token}`) };
}

export function giftTokenHash(token: string): string {
  return sha256(`gift:${token}`);
}
