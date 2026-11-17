import type { PersonalizationDraft, PersonalizedProduct, Prisma, PrismaClient, Product, Questionnaire } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { DRAFT_MODES, type DraftMode, type Locale } from "./constants";
import { readUnwrittenConfig } from "./config";
import { href } from "./i18n/routing";
import { audienceForMode, hasSensitiveAnswers, missingAnswers, pruneAnswers, validateStep, withoutSensitive, type Answers, type StepValidation } from "./questionnaire/engine";
import { allQuestions, definitionSchema, type QuestionnaireDefinition } from "./questionnaire/schema";
import { createResumeToken, fromUrlToken, toUrlToken, verifyResumeToken } from "./tokens";

/**
 * Brouillons de personnalisation (base injectable pour les tests).
 * Journalisation : uniquement des identifiants techniques, jamais de réponse ni d'adresse e-mail.
 */

export type DraftWithRefs = PersonalizationDraft & {
  questionnaire: Questionnaire;
  product: Product & { personalization: PersonalizedProduct | null };
};

export const draftInclude = { questionnaire: true, product: { include: { personalization: true } } } as const;

export class DraftError extends Error {
  constructor(public code: "unavailable" | "expired" | "locked" | "ordered" | "not_found" | "invalid_mode" | "incomplete" | "consent", message?: string) {
    super(message ?? code);
  }
}

const DAY = 86_400_000;
/** Délai après lequel une session de paiement abandonnée libère le brouillon (session Stripe : 1 h). */
export const CHECKOUT_LOCK_MS = 65 * 60_000;

export function draftDefinition(d: { questionnaire: Pick<Questionnaire, "definition"> }): QuestionnaireDefinition {
  return definitionSchema.parse(d.questionnaire.definition);
}

export function draftAnswers(d: Pick<PersonalizationDraft, "answers">): Answers {
  return d.answers && typeof d.answers === "object" && !Array.isArray(d.answers) ? (d.answers as Answers) : {};
}

export async function activeQuestionnaire(productId: string, db: PrismaClient = defaultPrisma) {
  return db.questionnaire.findFirst({ where: { productId, status: "ACTIVE" }, orderBy: { version: "desc" } });
}

export async function startDraft(
  input: { siteId: string; productId: string; locale: Locale; currency: string; mode?: DraftMode; utm?: Record<string, string> | null; retentionDays: number },
  db: PrismaClient = defaultPrisma,
  now = new Date(),
): Promise<DraftWithRefs> {
  const product = await db.product.findFirst({ where: { id: input.productId, siteId: input.siteId, status: "PUBLISHED" }, include: { personalization: true } });
  if (!product?.personalization) throw new DraftError("unavailable");
  const questionnaire = await activeQuestionnaire(product.id, db);
  if (!questionnaire) throw new DraftError("unavailable");
  return db.personalizationDraft.create({
    data: {
      siteId: input.siteId,
      productId: product.id,
      questionnaireId: questionnaire.id,
      locale: input.locale,
      currency: input.currency,
      mode: input.mode ?? "self",
      utm: input.utm && Object.keys(input.utm).length ? input.utm : undefined,
      expiresAt: new Date(now.getTime() + input.retentionDays * DAY),
    },
    include: draftInclude,
  });
}

export async function getDraft(id: string, db: PrismaClient = defaultPrisma): Promise<DraftWithRefs | null> {
  return db.personalizationDraft.findUnique({ where: { id }, include: draftInclude });
}

export type DraftState = "editable" | "checkout" | "ordered" | "expired";

/**
 * État d'un brouillon, avec ses transitions automatiques :
 *  - conservation dépassée → EXPIRED (les réponses sont effacées) ;
 *  - paiement abandonné (session expirée, échec, ou plus d'une heure sans confirmation) → ACTIVE.
 */
export async function resolveDraftState(draft: PersonalizationDraft, db: PrismaClient = defaultPrisma, now = new Date()): Promise<DraftState> {
  if (draft.status === "ORDERED") return "ordered";
  if (draft.status === "EXPIRED") return "expired";
  if (draft.expiresAt < now && draft.status === "ACTIVE") {
    await db.personalizationDraft.update({ where: { id: draft.id }, data: { status: "EXPIRED", answers: {}, email: null, giftRecipientEmail: null, giftRecipientName: null, giftMessage: null } });
    return "expired";
  }
  if (draft.status === "CHECKOUT") {
    const order = draft.orderId ? await db.order.findUnique({ where: { id: draft.orderId }, select: { status: true, createdAt: true } }) : null;
    if (order && ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.status)) return "ordered";
    // Sans commande liée (session en cours de création) : verrou tant que le délai n'est pas écoulé
    const abandoned = order
      ? order.status === "CANCELLED" || order.status === "FAILED" || (order.status === "PENDING" && now.getTime() - order.createdAt.getTime() > CHECKOUT_LOCK_MS)
      : now.getTime() - draft.updatedAt.getTime() > CHECKOUT_LOCK_MS;
    if (!abandoned) return "checkout";
    await db.personalizationDraft.update({ where: { id: draft.id }, data: { status: "ACTIVE", orderId: null } });
    draft.status = "ACTIVE";
    draft.orderId = null;
  }
  return "editable";
}

async function assertEditable(draft: PersonalizationDraft, db: PrismaClient, now: Date) {
  const state = await resolveDraftState(draft, db, now);
  if (state === "expired") throw new DraftError("expired");
  if (state === "checkout") throw new DraftError("locked");
  if (state === "ordered") throw new DraftError("ordered");
}

/** Sauvegarde une étape (rien n'est enregistré si l'étape est invalide). Expiration glissante. */
export async function saveDraftStep(
  draft: DraftWithRefs,
  stepId: string,
  input: Record<string, unknown>,
  opts: { consent: boolean; consentText?: string | null; retentionDays: number; stepIndex?: number },
  db: PrismaClient = defaultPrisma,
  now = new Date(),
): Promise<StepValidation> {
  await assertEditable(draft, db, now);
  const def = draftDefinition(draft);
  const consent = !!draft.sensitiveConsentAt || opts.consent;
  const result = validateStep(def, stepId, input, draftAnswers(draft), { consent, audience: audienceForMode(draft.mode) });
  if (!result.ok) return result;
  const grantConsent = !draft.sensitiveConsentAt && opts.consent && result.hasSensitive;
  await db.personalizationDraft.update({
    where: { id: draft.id },
    data: {
      answers: result.answers as Prisma.InputJsonValue,
      currentStep: Math.max(draft.currentStep, opts.stepIndex ?? draft.currentStep),
      expiresAt: new Date(now.getTime() + opts.retentionDays * DAY),
      ...(grantConsent ? { sensitiveConsentAt: now, consentText: opts.consentText ?? null } : {}),
    },
  });
  return result;
}

export interface ModeInput { mode: string; recipientName?: string | null; recipientEmail?: string | null; message?: string | null }

/** Choix du répondant (moi / cadeau que je remplis / cadeau rempli par le destinataire). */
export async function setDraftMode(draft: PersonalizationDraft, input: ModeInput, opts: { retentionDays: number }, db: PrismaClient = defaultPrisma, now = new Date()) {
  await assertEditable(draft, db, now);
  if (!(DRAFT_MODES as readonly string[]).includes(input.mode)) throw new DraftError("invalid_mode");
  const gift = input.mode !== "self";
  const email = input.recipientEmail?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DraftError("invalid_mode", "email");
  return db.personalizationDraft.update({
    where: { id: draft.id },
    data: {
      mode: input.mode,
      // Données sur un tiers : prénom et e-mail facultatifs, effacés si ce n'est plus un cadeau
      giftRecipientName: gift ? input.recipientName?.trim().slice(0, 40) || null : null,
      giftRecipientEmail: input.mode === "gift_recipient" ? email : null,
      giftMessage: gift ? input.message?.trim().slice(0, 500) || null : null,
      expiresAt: new Date(now.getTime() + opts.retentionDays * DAY),
    },
  });
}

/** Réponses à figer : en mode « destinataire », seules les réponses de l'acheteur sont conservées. */
export function answersToFreeze(def: QuestionnaireDefinition, draft: Pick<PersonalizationDraft, "answers" | "mode" | "sensitiveConsentAt">): Answers {
  let answers = pruneAnswers(def, draftAnswers(draft));
  if (draft.mode === "gift_recipient") {
    const buyer = new Set(allQuestions(def).filter((q) => q.audience === "buyer").map((q) => q.id));
    answers = Object.fromEntries(Object.entries(answers).filter(([k]) => buyer.has(k)));
  }
  if (!draft.sensitiveConsentAt) answers = withoutSensitive(def, answers);
  return answers;
}

/** Réponses obligatoires manquantes pour pouvoir payer. */
export function draftMissing(draft: DraftWithRefs): string[] {
  const def = draftDefinition(draft);
  return missingAnswers(def, draftAnswers(draft), { consent: !!draft.sensitiveConsentAt, audience: audienceForMode(draft.mode) });
}

export interface PersonalSnapshot {
  personalization: {
    draftId: string;
    questionnaireId: string;
    version: number;
    definition: QuestionnaireDefinition;
    answers: Answers;
    mode: string;
    locale: string;
    currency: string;
    gift: { recipientName: string | null; recipientEmail: string | null; message: string | null } | null;
    sensitiveConsentAt: string | null;
  };
}

export function draftSnapshot(draft: DraftWithRefs): PersonalSnapshot {
  const def = draftDefinition(draft);
  return {
    personalization: {
      draftId: draft.id,
      questionnaireId: draft.questionnaireId,
      version: draft.questionnaire.version,
      definition: def,
      answers: answersToFreeze(def, draft),
      mode: draft.mode,
      locale: draft.locale,
      currency: draft.currency,
      gift: draft.mode === "self" ? null : { recipientName: draft.giftRecipientName, recipientEmail: draft.giftRecipientEmail, message: draft.giftMessage },
      sensitiveConsentAt: draft.sensitiveConsentAt?.toISOString() ?? null,
    },
  };
}

/** Fige le brouillon avant le paiement (aucune modification possible pendant la session Stripe). */
export async function freezeDraftForCheckout(draft: DraftWithRefs, email: string | null, db: PrismaClient = defaultPrisma, now = new Date()) {
  await assertEditable(draft, db, now);
  if (draftMissing(draft).length) throw new DraftError("incomplete");
  const def = draftDefinition(draft);
  if (hasSensitiveAnswers(def, draftAnswers(draft)) && !draft.sensitiveConsentAt) throw new DraftError("consent");
  await db.personalizationDraft.update({ where: { id: draft.id }, data: { status: "CHECKOUT", ...(email ? { email } : {}) } });
  draft.status = "CHECKOUT";
}

/** Relâche un brouillon figé si la création de la session de paiement a échoué. */
export async function releaseDraft(draftId: string, db: PrismaClient = defaultPrisma) {
  await db.personalizationDraft.updateMany({ where: { id: draftId, status: "CHECKOUT" }, data: { status: "ACTIVE", orderId: null } });
}

/** Émet un lien de reprise (signé, usage unique) et mémorise l'adresse sur le brouillon. */
export async function issueResumeLink(
  draft: PersonalizationDraft,
  email: string,
  opts: { validityHours: number; baseUrl: string },
  db: PrismaClient = defaultPrisma,
  now = Date.now(),
): Promise<string> {
  const token = createResumeToken(draft.id, opts.validityHours * 3600, now);
  await db.personalizationDraft.update({ where: { id: draft.id }, data: { email: email.trim().toLowerCase(), resumeSentAt: new Date(now) } });
  const locale = (draft.locale === "fr" ? "fr" : "en") as Locale;
  return `${opts.baseUrl.replace(/\/$/, "")}${href(locale, "resume", toUrlToken(token))}`;
}

export type ResumeResult = { ok: true; draft: PersonalizationDraft } | { ok: false; reason: "invalid" | "used" | "expired" };

/** Consomme un lien de reprise : signature, expiration, usage unique, brouillon encore valable. */
export async function consumeResumeToken(token: string, db: PrismaClient = defaultPrisma, now = Date.now()): Promise<ResumeResult> {
  const parsed = verifyResumeToken(fromUrlToken(token), now);
  if (!parsed) return { ok: false, reason: "invalid" };
  const draft = await db.personalizationDraft.findUnique({ where: { id: parsed.draftId } });
  if (!draft) return { ok: false, reason: "invalid" };
  const state = await resolveDraftState(draft, db, new Date(now));
  if (state === "expired" || state === "ordered") return { ok: false, reason: "expired" };
  if (draft.lastResumedAt && draft.lastResumedAt.getTime() >= parsed.issuedAt) return { ok: false, reason: "used" };
  const updated = await db.personalizationDraft.update({ where: { id: draft.id }, data: { lastResumedAt: new Date(now) } });
  return { ok: true, draft: updated };
}

/** Suppression demandée par le client : définitive (hors brouillon déjà commandé, déjà vidé). */
export async function deleteDraft(id: string, db: PrismaClient = defaultPrisma): Promise<boolean> {
  const draft = await db.personalizationDraft.findUnique({ where: { id }, select: { status: true } });
  if (!draft) return false;
  if (draft.status === "CHECKOUT") throw new DraftError("locked");
  await db.personalizationDraft.delete({ where: { id } });
  return true;
}

/**
 * Purge RGPD (tâche quotidienne /api/cron/unwritten) :
 *  - brouillons dont la conservation est dépassée : supprimés ;
 *  - livres livrés ou annulés au-delà de la conservation : réponses et définition effacées.
 */
export async function purgeUnwrittenData(db: PrismaClient = defaultPrisma, now = new Date()) {
  const drafts = await db.personalizationDraft.deleteMany({ where: { expiresAt: { lt: now }, status: { in: ["ACTIVE", "EXPIRED", "ORDERED"] } } });
  const sites = await db.site.findMany({ where: { kind: "PERSONALIZED" }, select: { id: true, settings: true } });
  let items = 0;
  for (const site of sites) {
    const cutoff = new Date(now.getTime() - readUnwrittenConfig(site.settings).deliveredDataRetentionDays * DAY);
    const rows = await db.personalOrderItem.findMany({
      where: { siteId: site.id, dataPurgedAt: null, OR: [{ status: "DELIVERED", deliveredAt: { lt: cutoff } }, { status: "CANCELLED", cancelledAt: { lt: cutoff } }] },
      select: { id: true, questionnaire: true },
    });
    for (const row of rows) {
      const q = (row.questionnaire ?? {}) as { id?: string; version?: number };
      await db.personalOrderItem.update({ where: { id: row.id }, data: { answers: {}, questionnaire: { id: q.id ?? null, version: q.version ?? null }, dataPurgedAt: now } });
      await db.giftClaim.updateMany({ where: { personalItemId: row.id }, data: { answers: {}, recipientEmail: null, recipientName: null, message: null } });
      items += 1;
    }
  }
  return { draftsDeleted: drafts.count, itemsPurged: items };
}
