import { z } from "zod";
import type { Creator, CreatorSubmission, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { getCreatorSettings, rateForSubmission } from "./settings";
import { notifyTeam, sendCreatorInvite, sendPreviewReady, sendSubmissionDecision } from "./notify";
import { markSubmissionsPublished } from "./submissions";

/**
 * Opérations métier de l'espace créatrices (admin, API du studio, créatrice).
 * Les e-mails sont envoyés après l'écriture en base ; un échec d'envoi ne l'annule pas.
 */

async function quietly(p: Promise<unknown>) {
  try { await p; } catch (e) { console.error("[creators] e-mail non envoyé", e instanceof Error ? e.message : e); }
}

export const inviteSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide")),
  defaultRateBp: z.number().int().min(0).max(9000).nullable().optional(),
});

export async function inviteCreator(raw: unknown, db: PrismaClient = defaultPrisma, opts: { sendEmail?: boolean } = {}): Promise<Creator> {
  const input = inviteSchema.parse(raw);
  const existing = await db.creator.findUnique({ where: { email: input.email } });
  if (existing && existing.status !== "INVITED") throw new Error("Cette adresse correspond déjà à une créatrice active ou suspendue");
  const creator = existing
    ? await db.creator.update({ where: { id: existing.id }, data: { name: input.name, invitedAt: new Date(), ...(input.defaultRateBp !== undefined ? { defaultRateBp: input.defaultRateBp } : {}) } })
    : await db.creator.create({ data: { name: input.name, email: input.email, defaultRateBp: input.defaultRateBp ?? null } });
  if (opts.sendEmail !== false) await quietly(sendCreatorInvite(creator, db));
  return creator;
}

/** Slug public unique à partir du pseudo. */
export async function uniqueCreatorSlug(base: string, excludeId: string, db: PrismaClient = defaultPrisma): Promise<string> {
  const root = slugify(base) || "createur";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const other = await db.creator.findUnique({ where: { slug }, select: { id: true } });
    if (!other || other.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${excludeId.slice(-6)}`;
}

export type ModerationDecision = "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED";

export async function moderateSubmission(
  id: string,
  input: { decision: ModerationDecision; comment?: string | null; rateBp?: number | null },
  actor: { userId?: string | null } = {},
  db: PrismaClient = defaultPrisma,
  opts: { sendEmail?: boolean } = {},
): Promise<CreatorSubmission> {
  const sub = await db.creatorSubmission.findUniqueOrThrow({ where: { id }, include: { creator: true } });
  if (sub.status !== "SUBMITTED" && sub.status !== "CHANGES_REQUESTED" && !(sub.status === "ACCEPTED" && input.decision !== "ACCEPTED")) {
    throw new Error("Cette proposition n'est pas en attente de modération");
  }
  const comment = input.comment?.trim() || null;
  if (input.decision !== "ACCEPTED" && !comment) throw new Error("Un commentaire est requis pour refuser ou demander une modification");
  const settings = await getCreatorSettings(db);
  const rateBp = input.decision === "ACCEPTED" ? input.rateBp ?? sub.creator.defaultRateBp ?? rateForSubmission(sub, settings) : sub.rateBp;
  const updated = await db.creatorSubmission.update({
    where: { id },
    data: { status: input.decision, moderationComment: comment, moderatedAt: new Date(), moderatedById: actor.userId ?? null, rateBp },
  });
  if (opts.sendEmail !== false) await quietly(sendSubmissionDecision(updated, sub.creator, input.decision));
  return updated;
}

/** Studio : fabrication commencée (livre créé). */
export async function startProduction(id: string, bookId: string, db: PrismaClient = defaultPrisma): Promise<CreatorSubmission> {
  const sub = await db.creatorSubmission.findUniqueOrThrow({ where: { id } });
  if (!["ACCEPTED", "IN_PRODUCTION"].includes(sub.status)) throw new ConflictError(`Proposition au statut ${sub.status} : seule une proposition acceptée peut passer en fabrication`);
  return db.creatorSubmission.update({ where: { id }, data: { status: "IN_PRODUCTION", studioBookId: bookId.slice(0, 64) } });
}

/** Studio : aperçu prêt, lien envoyé à la créatrice pour validation. */
export async function markPreviewReady(id: string, previewUrl: string, db: PrismaClient = defaultPrisma, opts: { sendEmail?: boolean } = {}): Promise<CreatorSubmission> {
  const sub = await db.creatorSubmission.findUniqueOrThrow({ where: { id }, include: { creator: true } });
  if (!["ACCEPTED", "IN_PRODUCTION", "PREVIEW_READY"].includes(sub.status)) throw new ConflictError(`Proposition au statut ${sub.status} : l'aperçu ne peut plus être envoyé`);
  const changed = sub.previewUrl !== previewUrl || sub.status !== "PREVIEW_READY";
  const updated = await db.creatorSubmission.update({ where: { id }, data: { status: "PREVIEW_READY", previewUrl, previewReadyAt: changed ? new Date() : sub.previewReadyAt } });
  if (changed && opts.sendEmail !== false) await quietly(sendPreviewReady(updated, sub.creator, previewUrl));
  return updated;
}

/** Lie la proposition au produit de la boutique : crédit « Une idée de … » et taux de redevance. */
export async function linkSubmissionToProduct(id: string, productId: string, db: PrismaClient = defaultPrisma): Promise<CreatorSubmission> {
  const sub = await db.creatorSubmission.findUniqueOrThrow({ where: { id }, include: { creator: true } });
  if (!["ACCEPTED", "IN_PRODUCTION", "PREVIEW_READY", "APPROVED", "PUBLISHED"].includes(sub.status)) throw new ConflictError(`Proposition au statut ${sub.status} : impossible de la lier à un produit`);
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, creatorId: true, status: true } });
  if (!product) throw new NotFoundError("Produit introuvable");
  if (product.creatorId && product.creatorId !== sub.creatorId) throw new ConflictError("Ce produit est déjà crédité à une autre créatrice");
  const settings = await getCreatorSettings(db);
  const rateBp = sub.rateBp ?? sub.creator.defaultRateBp ?? rateForSubmission(sub, settings);
  const updated = await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { creatorId: sub.creatorId, creatorRateBp: rateBp } });
    return tx.creatorSubmission.update({ where: { id }, data: { productId, rateBp } });
  });
  if (product.status === "PUBLISHED" && updated.status === "APPROVED") await markSubmissionsPublished(productId, db);
  return db.creatorSubmission.findUniqueOrThrow({ where: { id } });
}

/** Créatrice : « Je valide » l'aperçu. */
export async function approvePreview(id: string, creatorId: string, db: PrismaClient = defaultPrisma, opts: { notify?: boolean } = {}): Promise<CreatorSubmission> {
  const sub = await db.creatorSubmission.findFirst({ where: { id, creatorId }, include: { product: { select: { status: true, name: true } } } });
  if (!sub) throw new Error("Proposition introuvable");
  if (sub.status !== "PREVIEW_READY") throw new Error("Aucun aperçu n'attend votre validation");
  const status = sub.product?.status === "PUBLISHED" ? "PUBLISHED" : "APPROVED";
  const updated = await db.creatorSubmission.update({ where: { id }, data: { status, approvedAt: new Date() } });
  if (opts.notify !== false) await quietly(notifyTeam("Aperçu validé par la créatrice", `L'aperçu de « ${sub.title} » a été validé. Le produit peut être mis en vente.`, `/admin/createurs/moderation/${id}`));
  return updated;
}

export class ConflictError extends Error { status = 409 as const; }
export class NotFoundError extends Error { status = 404 as const; }
