import type { Creator, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { createSessionToken, verifyLoginToken, verifySessionToken } from "./tokens";

/** Fonctions de connexion testables (base injectable) ; le cookie est posé par src/lib/creators/session.ts. */

export type LoginResult =
  | { ok: true; creator: Creator; sessionToken: string }
  | { ok: false; reason: "invalid" | "used" | "suspended" };

/**
 * Consomme un lien magique : signature et expiration vérifiées, lien refusé s'il a été
 * émis avant la dernière connexion (usage unique), créatrice suspendue refusée.
 */
export async function consumeLoginToken(token: string, db: PrismaClient = defaultPrisma, now = Date.now()): Promise<LoginResult> {
  const parsed = verifyLoginToken(token, now);
  if (!parsed) return { ok: false, reason: "invalid" };
  const creator = await db.creator.findUnique({ where: { id: parsed.creatorId } });
  if (!creator) return { ok: false, reason: "invalid" };
  if (creator.status === "SUSPENDED") return { ok: false, reason: "suspended" };
  if (creator.lastLoginAt && creator.lastLoginAt.getTime() >= parsed.issuedAt) return { ok: false, reason: "used" };
  const updated = await db.creator.update({ where: { id: creator.id }, data: { lastLoginAt: new Date(now) } });
  return { ok: true, creator: updated, sessionToken: createSessionToken(updated.id, updated.sessionVersion, now) };
}

/** Créatrice d'une session : jeton valide, version de session à jour, non suspendue. */
export async function creatorFromSession(token: string | null | undefined, db: PrismaClient = defaultPrisma, now = Date.now()): Promise<Creator | null> {
  const s = verifySessionToken(token, now);
  if (!s) return null;
  const creator = await db.creator.findUnique({ where: { id: s.creatorId } });
  if (!creator || creator.status === "SUSPENDED" || creator.sessionVersion !== s.version) return null;
  return creator;
}
