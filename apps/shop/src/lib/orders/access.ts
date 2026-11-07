import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, signPayload, verifySignedPayload } from "@/lib/tokens";

/**
 * Accès aux fichiers achetés, sans compte client :
 *  - page de commande : /commande/[token]        (jeton signé, lié à la commande)
 *  - espace « mes achats » : /mes-achats/[token] (lien magique envoyé par email)
 *  - téléchargement : /api/download/[entitlementToken]/[fileId]
 */

export function orderAccessUrl(orderId: string, validitySeconds = 60 * 60 * 24 * 365): string {
  const token = signPayload(`order:${orderId}`, Math.floor(Date.now() / 1000) + validitySeconds);
  return `${env.appUrl}/commande/${token}`;
}

export function verifyOrderAccessToken(token: string): string | null {
  const payload = verifySignedPayload(token);
  if (!payload?.startsWith("order:")) return null;
  return payload.slice("order:".length);
}

export function downloadUrl(entitlementToken: string, fileId: string): string {
  return `${env.appUrl}/api/download/${entitlementToken}/${fileId}`;
}

export async function createAccessLink(email: string, validityHours: number, db: PrismaClient = defaultPrisma): Promise<{ url: string } | null> {
  const customer = await db.customer.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!customer) return null;
  const token = randomToken(32);
  await db.accessLink.create({
    data: { customerId: customer.id, token, expiresAt: new Date(Date.now() + validityHours * 3600 * 1000) },
  });
  return { url: `${env.appUrl}/mes-achats/${token}` };
}

export type DownloadCheck =
  | { ok: true; entitlementId: string; storageKey: string; fileName: string; mime: string }
  | { ok: false; status: 403 | 404 | 410 | 429; reason: string };

/**
 * Vérifie qu'un téléchargement est autorisé et l'enregistre.
 * Règles : droit existant, non révoqué, non expiré, commande payée, quota non dépassé.
 */
export async function authorizeDownload(
  entitlementToken: string,
  fileId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
  db: PrismaClient = defaultPrisma,
  now = new Date(),
): Promise<DownloadCheck> {
  const ent = await db.downloadEntitlement.findUnique({
    where: { token: entitlementToken },
    include: { order: { select: { status: true } }, product: { include: { files: true } } },
  });
  if (!ent) return { ok: false, status: 404, reason: "Lien de téléchargement inconnu" };
  if (ent.revokedAt) return { ok: false, status: 403, reason: "Accès révoqué" };
  if (ent.expiresAt && ent.expiresAt < now) return { ok: false, status: 410, reason: "Lien expiré — demandez un nouveau lien depuis « Retrouver mes achats »" };
  if (ent.order.status !== "PAID" && ent.order.status !== "PARTIALLY_REFUNDED") return { ok: false, status: 403, reason: "Commande non payée" };
  if (ent.downloadCount >= ent.maxDownloads) return { ok: false, status: 429, reason: "Nombre maximal de téléchargements atteint — contactez le support" };
  const file = ent.product.files.find((f) => f.id === fileId);
  if (!file) return { ok: false, status: 404, reason: "Fichier introuvable" };

  await db.$transaction([
    db.downloadEntitlement.update({ where: { id: ent.id }, data: { downloadCount: { increment: 1 }, lastDownloadedAt: now } }),
    db.downloadLog.create({ data: { entitlementId: ent.id, fileId: file.id, ip: meta.ip ?? undefined, userAgent: meta.userAgent?.slice(0, 300) ?? undefined } }),
  ]);

  return { ok: true, entitlementId: ent.id, storageKey: file.storageKey, fileName: file.name, mime: file.mime };
}
