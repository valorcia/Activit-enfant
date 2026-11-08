import type { ApiKey, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { sha256 } from "@/lib/tokens";

export const API_SCOPES = ["products:read", "products:write", "products:publish"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export type ApiAuthResult =
  | { ok: true; key: Pick<ApiKey, "id" | "name" | "prefix" | "scopes"> }
  | { ok: false; status: 401 | 403 | 429; error: string };

/** Extrait la clé du header Authorization: Bearer <clé>. */
export function extractBearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Limitation de débit simple en mémoire (par clé) : 60 requêtes / minute.
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(keyId: string, now = Date.now()): boolean {
  const b = buckets.get(keyId);
  if (!b || b.resetAt <= now) {
    buckets.set(keyId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  b.count += 1;
  return b.count <= RATE_LIMIT;
}

export function resetRateLimits() {
  buckets.clear();
}

/**
 * Authentifie une requête API : clé présente, hash connu, non révoquée, scope requis.
 * Met à jour lastUsedAt (sans bloquer).
 */
export async function authenticateApiKey(req: Request, requiredScope?: ApiScope, db: PrismaClient = defaultPrisma): Promise<ApiAuthResult> {
  const raw = extractBearer(req);
  if (!raw) return { ok: false, status: 401, error: "Clé API manquante (header Authorization: Bearer <clé>)" };
  const key = await db.apiKey.findUnique({ where: { keyHash: sha256(raw) }, select: { id: true, name: true, prefix: true, scopes: true, revokedAt: true } });
  if (!key) return { ok: false, status: 401, error: "Clé API inconnue" };
  if (key.revokedAt) return { ok: false, status: 401, error: "Clé API révoquée" };
  // products:write (et products:publish) impliquent la lecture : une intégration qui écrit doit pouvoir relire le catalogue
  const effective = new Set(key.scopes);
  if (effective.has("products:write") || effective.has("products:publish")) effective.add("products:read");
  if (requiredScope && !effective.has(requiredScope)) {
    return { ok: false, status: 403, error: `Permission manquante : ${requiredScope}` };
  }
  if (!checkRateLimit(key.id)) return { ok: false, status: 429, error: "Trop de requêtes : limite de 60 requêtes par minute" };
  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return { ok: true, key: { id: key.id, name: key.name, prefix: key.prefix, scopes: key.scopes } };
}

export function apiError(status: number, error: string, details?: unknown) {
  return Response.json({ error, ...(details !== undefined ? { details } : {}) }, { status });
}

export function apiOk(data: unknown, status = 200, extra: Record<string, unknown> = {}) {
  return Response.json({ data, ...extra }, { status });
}
