import type { Creator, CreatorSubmission, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { creatorAdminNoticeEmail, creatorInviteEmail, creatorLoginEmail, payoutPaidEmail, previewReadyEmail, submissionDecisionEmail } from "@/lib/email/templates";
import { emailBrandForSite } from "@/lib/sites/email";
import { getCreatorSettings, formatRate } from "./settings";
import { createLoginToken } from "./tokens";

/**
 * E-mails de l'espace créatrices. Les liens pointent vers l'univers par défaut
 * (l'espace créatrice est commun à tous les univers). Aucune adresse n'est journalisée.
 */

async function brand() {
  return emailBrandForSite(null);
}

export function creatorSpaceUrl(appUrl: string, path = ""): string {
  return `${appUrl.replace(/\/$/, "")}/espace-createur${path}`;
}

export function loginUrl(appUrl: string, token: string): string {
  return creatorSpaceUrl(appUrl, `/connexion?jeton=${encodeURIComponent(token)}`);
}

export async function sendCreatorInvite(creator: Pick<Creator, "id" | "name" | "email">, db: PrismaClient = defaultPrisma) {
  const [b, s] = await Promise.all([brand(), getCreatorSettings(db)]);
  const token = createLoginToken(creator.id, s.inviteLinkValidityDays * 86400);
  return sendEmail({ to: creator.email, ...creatorInviteEmail(b, { name: creator.name, loginUrl: loginUrl(b.appUrl, token), validityDays: s.inviteLinkValidityDays }) });
}

export async function sendCreatorLoginLink(creator: Pick<Creator, "id" | "email">, db: PrismaClient = defaultPrisma) {
  const [b, s] = await Promise.all([brand(), getCreatorSettings(db)]);
  const token = createLoginToken(creator.id, s.loginLinkValidityMinutes * 60);
  return sendEmail({ to: creator.email, ...creatorLoginEmail(b, { loginUrl: loginUrl(b.appUrl, token), validityMinutes: s.loginLinkValidityMinutes }) });
}

export async function sendSubmissionDecision(sub: Pick<CreatorSubmission, "id" | "title" | "rateBp" | "moderationComment">, creator: Pick<Creator, "email">, decision: "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED") {
  const b = await brand();
  return sendEmail({
    to: creator.email,
    replyTo: b.contactEmail ?? undefined,
    ...submissionDecisionEmail(b, { title: sub.title, decision, comment: sub.moderationComment, rateLabel: decision === "ACCEPTED" && sub.rateBp != null ? formatRate(sub.rateBp) : null, url: creatorSpaceUrl(b.appUrl, `/idees/${sub.id}`) }),
  });
}

export async function sendPreviewReady(sub: Pick<CreatorSubmission, "id" | "title">, creator: Pick<Creator, "email">, previewUrl: string) {
  const b = await brand();
  return sendEmail({ to: creator.email, replyTo: b.contactEmail ?? undefined, ...previewReadyEmail(b, { title: sub.title, previewUrl, url: creatorSpaceUrl(b.appUrl, `/idees/${sub.id}`) }) });
}

export async function sendPayoutPaid(creator: Pick<Creator, "email">, payout: { totalCents: number; period: string }) {
  const b = await brand();
  return sendEmail({ to: creator.email, ...payoutPaidEmail(b, { amountCents: payout.totalCents, period: payout.period, url: creatorSpaceUrl(b.appUrl) }) });
}

/** Prévient l'équipe (adresse de contact de la marque), si elle est renseignée. */
export async function notifyTeam(subject: string, message: string, adminPath: string) {
  const b = await brand();
  if (!b.contactEmail) return { ok: false };
  return sendEmail({ to: b.contactEmail, ...creatorAdminNoticeEmail(b, { subject, message, url: `${b.appUrl.replace(/\/$/, "")}${adminPath}` }) });
}
