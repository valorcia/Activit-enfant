import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { signPayload, verifySignedPayload } from "@/lib/tokens";

/**
 * Jetons de l'espace créatrices (sans dépendance à la base, utilisables dans le proxy) :
 *  - lien magique de connexion : « clogin:<creatorId>:<émis à (ms)> », court et à usage unique
 *    (refusé s'il a été émis avant la dernière connexion) ;
 *  - session : « csess:<creatorId>:<version> », dans un cookie httpOnly distinct de l'admin.
 * Le secret est dérivé et propre à l'espace créatrices : un jeton de téléchargement ou
 * d'accès aux commandes ne peut pas servir de session, et inversement.
 */

export const CREATOR_SESSION_COOKIE = "creator_session";
export const CREATOR_SESSION_DAYS = 30;

function creatorSecret(): string {
  const base = env.authSecret || env.downloadTokenSecret;
  return createHash("sha256").update(`espace-createur:${base}`).digest("base64url");
}

export function createLoginToken(creatorId: string, validitySeconds: number, now = Date.now()): string {
  return signPayload(`clogin:${creatorId}:${now}`, Math.floor(now / 1000) + validitySeconds, creatorSecret());
}

export function verifyLoginToken(token: string, now = Date.now()): { creatorId: string; issuedAt: number } | null {
  const payload = verifySignedPayload(token, creatorSecret(), Math.floor(now / 1000));
  const m = payload ? /^clogin:([a-z0-9]+):(\d+)$/i.exec(payload) : null;
  if (!m) return null;
  return { creatorId: m[1], issuedAt: Number(m[2]) };
}

export function createSessionToken(creatorId: string, version: number, now = Date.now(), days = CREATOR_SESSION_DAYS): string {
  return signPayload(`csess:${creatorId}:${version}`, Math.floor(now / 1000) + days * 86400, creatorSecret());
}

export function verifySessionToken(token: string | null | undefined, now = Date.now()): { creatorId: string; version: number } | null {
  if (!token) return null;
  const payload = verifySignedPayload(token, creatorSecret(), Math.floor(now / 1000));
  const m = payload ? /^csess:([a-z0-9]+):(\d+)$/i.exec(payload) : null;
  if (!m) return null;
  return { creatorId: m[1], version: Number(m[2]) };
}

/** Chemins de l'espace créatrices accessibles sans session (connexion par lien magique). */
export function isPublicCreatorPath(pathname: string): boolean {
  return pathname === "/espace-createur/connexion" || pathname.startsWith("/espace-createur/connexion/");
}
