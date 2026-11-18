import type { GiftClaim, OrderItem, PersonalItemStatus, PersonalOrderItem, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { randomToken } from "@/lib/tokens";
import { readUnwrittenConfig } from "./config";
import type { PersonalSnapshot } from "./drafts";
import { missingAnswers, photoEntries, validateStep, type Answers, type StepValidation } from "./questionnaire/engine";
import { bookPlan } from "./book-plan";
import { COLLECTION_KEYS, type CollectionKey, type Locale } from "./constants";
import { definitionSchema, type QuestionnaireDefinition } from "./questionnaire/schema";
import { giftTokenHash, newGiftToken } from "./tokens";
import { deletePhotos, removedPhotoIds } from "./photos";

/**
 * Cycle de vie d'un livre commandé (PersonalOrderItem) :
 *   paiement confirmé (webhook) → AWAITING_RECIPIENT (cadeau rempli par le destinataire) ou PENDING_GENERATION
 *   → IN_PRODUCTION (studio) → DELIVERED (PDF déposé, droit de téléchargement, e-mail)
 *   ↘ ERROR (studio, relance possible) ; CANCELLED (remboursement total avant livraison).
 * Aucune génération n'est déclenchée par la boutique : le studio interroge l'API v1.
 */

type Tx = Prisma.TransactionClient;
type Db = PrismaClient;
const DAY = 86_400_000;

export class PersonalItemError extends Error {
  constructor(message: string, public status: 404 | 409 | 422 = 409) {
    super(message);
  }
}

function snapshotOf(item: Pick<OrderItem, "snapshot">): PersonalSnapshot["personalization"] | null {
  const snap = item.snapshot as Partial<PersonalSnapshot> | null;
  return snap?.personalization ?? null;
}

/**
 * Appelé DANS la transaction du webhook (fulfillOrderFromSession), après le passage en PAID.
 * Idempotent : un seul PersonalOrderItem par ligne de commande (clé unique orderItemId).
 */
export async function createPersonalItemsInTx(tx: Tx, order: { id: string; siteId: string; items: OrderItem[] }, now = new Date()): Promise<string[]> {
  const lines = order.items.filter((i) => i.personalDraftId);
  if (!lines.length) return [];
  const site = await tx.site.findUnique({ where: { id: order.siteId }, select: { settings: true } });
  const config = readUnwrittenConfig(site?.settings);
  const created: string[] = [];
  for (const line of lines) {
    const existing = await tx.personalOrderItem.findUnique({ where: { orderItemId: line.id }, select: { id: true } });
    if (existing) continue;
    const snap = snapshotOf(line);
    if (!snap) continue;
    const recipientFills = snap.mode === "gift_recipient";
    const item = await tx.personalOrderItem.create({
      data: {
        siteId: order.siteId,
        orderId: order.id,
        orderItemId: line.id,
        productId: line.productId,
        draftId: line.personalDraftId,
        locale: snap.locale,
        status: recipientFills ? "AWAITING_RECIPIENT" : "PENDING_GENERATION",
        isGift: snap.mode !== "self",
        mode: snap.mode,
        answers: snap.answers as Prisma.InputJsonValue,
        questionnaire: { id: snap.questionnaireId, version: snap.version, definition: snap.definition } as Prisma.InputJsonValue,
      },
    });
    if (recipientFills) {
      // Jeton provisoire inconnu de tous : le vrai lien est émis (rotation) au moment de l'e-mail
      await tx.giftClaim.create({
        data: {
          personalItemId: item.id,
          tokenHash: newGiftToken().hash,
          recipientName: snap.gift?.recipientName ?? null,
          recipientEmail: snap.gift?.recipientEmail ?? null,
          message: snap.gift?.message ?? null,
          expiresAt: new Date(now.getTime() + config.giftLinkValidityDays * DAY),
        },
      });
    }
    if (line.personalDraftId) {
      // Minimisation : les réponses vivent désormais dans la commande ; le brouillon est vidé
      await tx.personalizationDraft.updateMany({
        where: { id: line.personalDraftId },
        data: { status: "ORDERED", orderId: order.id, answers: {}, contributions: [], giftRecipientEmail: null, giftRecipientName: null, giftMessage: null },
      });
    }
    if (line.productId) await tx.product.update({ where: { id: line.productId }, data: { salesCount: { increment: 1 } } });
    created.push(item.id);
  }
  return created;
}

/** Remboursement total : les livres non livrés sont annulés (le droit de téléchargement est déjà révoqué). */
export async function cancelPersonalItemsForOrder(orderId: string, db: Db = defaultPrisma, now = new Date()) {
  const res = await db.personalOrderItem.updateMany({ where: { orderId, status: { notIn: ["DELIVERED", "CANCELLED"] } }, data: { status: "CANCELLED", cancelledAt: now } });
  await db.giftClaim.updateMany({ where: { personalItem: { orderId }, completedAt: null, revokedAt: null }, data: { revokedAt: now } });
  return res.count;
}

export function itemDefinition(item: Pick<PersonalOrderItem, "questionnaire">): QuestionnaireDefinition | null {
  const q = item.questionnaire as { definition?: unknown } | null;
  const parsed = definitionSchema.safeParse(q?.definition);
  return parsed.success ? parsed.data : null;
}

export function itemAnswers(item: Pick<PersonalOrderItem, "answers">): Answers {
  return item.answers && typeof item.answers === "object" && !Array.isArray(item.answers) ? (item.answers as Answers) : {};
}

// ---------------------------------------------------------------------------
// Studio (API v1)
// ---------------------------------------------------------------------------

export const STUDIO_VISIBLE: PersonalItemStatus[] = ["PENDING_GENERATION", "IN_PRODUCTION", "ERROR", "DELIVERED"];

const studioInclude = { order: { select: { number: true, paidAt: true } }, product: { select: { id: true, slug: true, name: true, personalization: { select: { collectionKey: true, pagesMin: true, pagesMax: true, formats: true } } } }, gift: { select: { recipientName: true, message: true } } } as const;
type StudioRow = Prisma.PersonalOrderItemGetPayload<{ include: typeof studioInclude }>;

/**
 * Représentation envoyée au studio. Minimisation : ni e-mail, ni nom de facturation, ni adresse ;
 * seulement ce qui sert à écrire le livre (réponses figées, langue, édition, dédicace, prénom du destinataire).
 */
export function serializeForStudio(row: StudioRow) {
  const q = (row.questionnaire ?? {}) as { id?: string; version?: number; definition?: unknown };
  const answers = itemAnswers(row);
  const def = itemDefinition(row);
  const key = row.product?.personalization?.collectionKey;
  const collection = key && (COLLECTION_KEYS as readonly string[]).includes(key) ? (key as CollectionKey) : null;
  const locale: Locale = row.locale === "fr" ? "fr" : "en";
  // Photos : téléchargées par le studio via /api/v1/personal/items/:id/photos/:photoId (clé personal:read)
  const photos = def
    ? def.steps.flatMap((s) => s.questions).filter((x) => x.type === "photos").flatMap((x) => photoEntries(answers[x.id]).map((e, i) => ({ id: e.id, questionId: x.id, position: i, caption: e.caption || null, path: `/api/v1/personal/items/${row.id}/photos/${e.id}` })))
    : [];
  return {
    id: row.id,
    status: row.status,
    orderNumber: row.order.number,
    paidAt: row.order.paidAt?.toISOString() ?? null,
    locale: row.locale,
    mode: row.mode,
    isGift: row.isGift,
    product: row.product ? { id: row.product.id, slug: row.product.slug, name: row.product.name, collectionKey: row.product.personalization?.collectionKey ?? null, pagesMin: row.product.personalization?.pagesMin ?? null, pagesMax: row.product.personalization?.pagesMax ?? null, formats: row.product.personalization?.formats ?? [] } : null,
    questionnaire: { id: q.id ?? null, version: q.version ?? null, definition: q.definition ?? null },
    answers,
    photos,
    // Plan à suivre pour la génération (chapitres, pages, emplacements photo) : voir book-plan.ts
    plan: collection ? bookPlan(collection, { locale, answers, knownQuestions: def ? def.steps.flatMap((s) => s.questions.map((x) => x.id)) : undefined }) : null,
    gift: row.gift ? { recipientName: row.gift.recipientName, message: row.gift.message } : null,
    studioRef: row.studioRef,
    lastError: row.lastError,
    errorCount: row.errorCount,
    file: row.fileKey ? { name: row.fileName, mime: row.fileMime, sizeBytes: row.fileSize } : null,
    dataPurged: !!row.dataPurgedAt,
    createdAt: row.createdAt.toISOString(),
    productionStartedAt: row.productionStartedAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
  };
}

export async function listForStudio(opts: { status?: PersonalItemStatus[]; limit?: number; after?: string | null }, db: Db = defaultPrisma) {
  const statuses = (opts.status?.length ? opts.status : (["PENDING_GENERATION"] as PersonalItemStatus[])).filter((s) => STUDIO_VISIBLE.includes(s));
  const take = Math.min(100, Math.max(1, opts.limit ?? 20));
  const rows = await db.personalOrderItem.findMany({
    where: { status: { in: statuses } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], // premier payé, premier produit
    take: take + 1,
    ...(opts.after ? { cursor: { id: opts.after }, skip: 1 } : {}),
    include: studioInclude,
  });
  const page = rows.slice(0, take);
  return { items: page.map(serializeForStudio), nextCursor: rows.length > take ? page[page.length - 1].id : null };
}

export async function getForStudio(id: string, db: Db = defaultPrisma) {
  const row = await db.personalOrderItem.findUnique({ where: { id }, include: studioInclude });
  if (!row || !STUDIO_VISIBLE.includes(row.status)) return null;
  return serializeForStudio(row);
}

async function loadItem(id: string, db: Db) {
  const item = await db.personalOrderItem.findUnique({ where: { id } });
  if (!item) throw new PersonalItemError("Livre introuvable", 404);
  return item;
}

/** PENDING_GENERATION ou ERROR → IN_PRODUCTION (idempotent si déjà en production). */
export async function startProduction(id: string, studioRef: string | null, db: Db = defaultPrisma, now = new Date()) {
  const item = await loadItem(id, db);
  if (item.status === "IN_PRODUCTION") return item;
  if (item.status !== "PENDING_GENERATION" && item.status !== "ERROR") throw new PersonalItemError(`Transition impossible depuis ${item.status}`);
  return db.personalOrderItem.update({ where: { id }, data: { status: "IN_PRODUCTION", studioRef: studioRef ?? item.studioRef, productionStartedAt: item.productionStartedAt ?? now, lastError: null } });
}

/** Erreur signalée par le studio (message technique, sans donnée personnelle attendue). */
export async function reportProductionError(id: string, message: string, db: Db = defaultPrisma) {
  const item = await loadItem(id, db);
  if (item.status !== "IN_PRODUCTION" && item.status !== "PENDING_GENERATION" && item.status !== "ERROR") throw new PersonalItemError(`Transition impossible depuis ${item.status}`);
  return db.personalOrderItem.update({ where: { id }, data: { status: "ERROR", lastError: message.slice(0, 500), errorCount: { increment: 1 } } });
}

export function personalFilePrefix(id: string) {
  return `private/personal/${id}/`;
}

/** Enregistre le PDF final (déposé par URL présignée ou envoyé directement). */
export async function attachPersonalFile(id: string, file: { key: string; name: string; mime: string; size: number }, db: Db = defaultPrisma) {
  const item = await loadItem(id, db);
  if (!["IN_PRODUCTION", "ERROR", "DELIVERED"].includes(item.status)) throw new PersonalItemError(`Dépôt impossible depuis ${item.status} : passez d'abord le livre en production`);
  if (!file.key.startsWith(personalFilePrefix(id)) || file.key.includes("..")) throw new PersonalItemError("Clé de fichier invalide pour ce livre", 422);
  if (file.mime !== "application/pdf") throw new PersonalItemError("PDF attendu", 422);
  return db.personalOrderItem.update({ where: { id }, data: { fileKey: file.key, fileName: file.name.slice(0, 160), fileMime: file.mime, fileSize: file.size } });
}

/**
 * Livraison : droit de téléchargement individuel (lié au livre) puis statut DELIVERED.
 * Idempotent : un second appel ne crée ni droit ni e-mail supplémentaire (`firstDelivery` = false).
 */
export async function deliverPersonalItem(id: string, db: Db = defaultPrisma, now = new Date()) {
  const item = await db.personalOrderItem.findUnique({ where: { id }, include: { order: { select: { id: true, status: true, customerId: true } }, entitlement: true } });
  if (!item) throw new PersonalItemError("Livre introuvable", 404);
  if (item.status === "DELIVERED" && item.entitlement) return { item, entitlement: item.entitlement, firstDelivery: false };
  if (item.status !== "IN_PRODUCTION" && item.status !== "ERROR") throw new PersonalItemError(`Livraison impossible depuis ${item.status}`);
  if (!item.fileKey) throw new PersonalItemError("Aucun PDF déposé pour ce livre", 422);
  if (!item.productId) throw new PersonalItemError("Produit supprimé : livraison manuelle nécessaire", 422);
  if (item.order.status !== "PAID" && item.order.status !== "PARTIALLY_REFUNDED") throw new PersonalItemError("Commande non payée ou remboursée");
  const site = await db.site.findUnique({ where: { id: item.siteId }, select: { settings: true } });
  const config = readUnwrittenConfig(site?.settings);
  return db.$transaction(async (tx) => {
    const entitlement = await tx.downloadEntitlement.create({
      data: { orderId: item.orderId, productId: item.productId!, customerId: item.order.customerId ?? undefined, token: randomToken(24), maxDownloads: config.maxDownloads, personalItemId: item.id },
    });
    const updated = await tx.personalOrderItem.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: now, lastError: null } });
    return { item: updated, entitlement, firstDelivery: true };
  });
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

/** Relance manuelle d'un livre en erreur : retour dans la file du studio. */
export async function requeueItem(id: string, db: Db = defaultPrisma) {
  const item = await loadItem(id, db);
  if (item.status !== "ERROR") throw new PersonalItemError("Seul un livre en erreur peut être remis en file");
  return db.personalOrderItem.update({ where: { id }, data: { status: "PENDING_GENERATION" } });
}

// ---------------------------------------------------------------------------
// Option cadeau : le destinataire complète lui-même ses informations
// ---------------------------------------------------------------------------

/** Émet un nouveau lien pour le destinataire (l'ancien est aussitôt invalide). */
export async function rotateGiftToken(personalItemId: string, db: Db = defaultPrisma, now = new Date()): Promise<{ token: string; claim: GiftClaim }> {
  const item = await db.personalOrderItem.findUnique({ where: { id: personalItemId }, include: { gift: true } });
  if (!item?.gift) throw new PersonalItemError("Ce livre n'est pas un cadeau à compléter", 404);
  if (item.status !== "AWAITING_RECIPIENT" || item.gift.completedAt || item.gift.revokedAt) throw new PersonalItemError("Le destinataire a déjà répondu, ou le cadeau est annulé");
  const site = await db.site.findUnique({ where: { id: item.siteId }, select: { settings: true } });
  const { token, hash } = newGiftToken();
  const claim = await db.giftClaim.update({
    where: { id: item.gift.id },
    data: { tokenHash: hash, sentAt: now, expiresAt: new Date(now.getTime() + readUnwrittenConfig(site?.settings).giftLinkValidityDays * DAY) },
  });
  return { token, claim };
}

const giftInclude = { personalItem: { include: { product: { include: { personalization: true } }, order: { select: { billingName: true, number: true } } } } } as const;
export type GiftWithItem = Prisma.GiftClaimGetPayload<{ include: typeof giftInclude }>;

export type GiftLookup = { ok: true; claim: GiftWithItem } | { ok: false; reason: "invalid" | "completed" };

export async function findGiftByToken(token: string, db: Db = defaultPrisma, now = new Date()): Promise<GiftLookup> {
  if (!token || token.length < 20 || token.length > 100) return { ok: false, reason: "invalid" };
  const claim = await db.giftClaim.findUnique({ where: { tokenHash: giftTokenHash(token) }, include: giftInclude });
  if (!claim || claim.revokedAt || (claim.expiresAt && claim.expiresAt < now)) return { ok: false, reason: "invalid" };
  if (claim.completedAt || claim.personalItem.status !== "AWAITING_RECIPIENT") return { ok: false, reason: "completed" };
  if (!claim.openedAt) await db.giftClaim.update({ where: { id: claim.id }, data: { openedAt: now } });
  return { ok: true, claim };
}

export function giftAnswers(claim: Pick<GiftClaim, "answers">): Answers {
  return claim.answers && typeof claim.answers === "object" && !Array.isArray(claim.answers) ? (claim.answers as Answers) : {};
}

/** Réponses combinées (acheteur + destinataire) servant à évaluer les conditions. */
export function combinedGiftAnswers(claim: GiftWithItem): Answers {
  return { ...itemAnswers(claim.personalItem), ...giftAnswers(claim) };
}

/** Sauvegarde d'une étape par le destinataire (questions « subject » seulement). */
export async function saveGiftStep(claim: GiftWithItem, stepId: string, input: Record<string, unknown>, opts: { consent: boolean }, db: Db = defaultPrisma, now = new Date()): Promise<StepValidation> {
  const def = itemDefinition(claim.personalItem);
  if (!def) throw new PersonalItemError("Questionnaire indisponible", 422);
  const consent = !!claim.sensitiveConsentAt || opts.consent;
  const buyer = itemAnswers(claim.personalItem);
  const result = validateStep(def, stepId, input, combinedGiftAnswers(claim), { consent, audience: "subject" });
  if (!result.ok) return result;
  // On ne conserve côté destinataire que ses propres réponses
  const own = Object.fromEntries(Object.entries(result.answers).filter(([k]) => !(k in buyer)));
  await deletePhotos(removedPhotoIds(giftAnswers(claim), own));
  await db.giftClaim.update({
    where: { id: claim.id },
    data: { answers: own as Prisma.InputJsonValue, ...(opts.consent && result.hasSensitive && !claim.sensitiveConsentAt ? { sensitiveConsentAt: now } : {}) },
  });
  return result;
}

/** Le destinataire envoie ses réponses : le livre entre dans la file du studio. */
export async function completeGift(claimId: string, db: Db = defaultPrisma, now = new Date()) {
  const claim = await db.giftClaim.findUnique({ where: { id: claimId }, include: giftInclude });
  if (!claim || claim.completedAt || claim.revokedAt) throw new PersonalItemError("Cadeau indisponible");
  const def = itemDefinition(claim.personalItem);
  if (!def) throw new PersonalItemError("Questionnaire indisponible", 422);
  const all = combinedGiftAnswers(claim);
  const missing = missingAnswers(def, all, { consent: !!claim.sensitiveConsentAt, audience: "subject" });
  if (missing.length) throw new PersonalItemError(`Réponses manquantes : ${missing.join(", ")}`, 422);
  await db.$transaction([
    db.personalOrderItem.update({ where: { id: claim.personalItemId }, data: { answers: all as Prisma.InputJsonValue, status: "PENDING_GENERATION" } }),
    // Les réponses passent dans la commande ; le destinataire n'a plus accès au formulaire
    db.giftClaim.update({ where: { id: claim.id }, data: { completedAt: now, answers: {} } }),
  ]);
}
