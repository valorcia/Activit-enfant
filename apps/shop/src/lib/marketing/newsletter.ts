import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { newsletterConfirmEmail } from "@/lib/email/templates";
import { getSetting } from "@/lib/settings";
import { randomToken } from "@/lib/tokens";
import { emitMarketingEvent } from "./events";

export const NEWSLETTER_CONSENT_TEXT =
  "J'accepte de recevoir par email les nouvelles aventures et offres promotionnelles. Désinscription possible à tout moment.";

export async function subscribeToNewsletter(input: { email: string; firstName?: string | null; source?: string; ip?: string | null }) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing?.status === "CONFIRMED") return { status: "already" as const };

  const confirmToken = randomToken(24);
  const sub = await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: { email, firstName: input.firstName ?? undefined, status: "PENDING", confirmToken, unsubToken: randomToken(24), source: input.source },
    update: { firstName: input.firstName ?? undefined, status: "PENDING", confirmToken, unsubscribedAt: null },
  });
  await prisma.marketingConsent.create({
    data: { email, channel: "email", purpose: "newsletter", granted: true, text: NEWSLETTER_CONSENT_TEXT, source: input.source, ip: input.ip ?? undefined },
  });
  await emitMarketingEvent("subscriber.created", email, { source: input.source ?? null });

  const brand = await getSetting("brand");
  const theme = await getSetting("theme");
  const confirmUrl = `${env.appUrl}/newsletter/confirmation/${sub.confirmToken}`;
  await sendEmail({ to: email, ...newsletterConfirmEmail({ name: brand.name, appUrl: env.appUrl, contactEmail: brand.contactEmail, color: theme.colors.coral }, { confirmUrl }) });
  return { status: "pending" as const };
}

export async function confirmNewsletter(token: string) {
  const sub = await prisma.newsletterSubscriber.findUnique({ where: { confirmToken: token } });
  if (!sub) return false;
  await prisma.newsletterSubscriber.update({ where: { id: sub.id }, data: { status: "CONFIRMED", confirmedAt: new Date(), confirmToken: null } });
  await emitMarketingEvent("subscriber.confirmed", sub.email);
  return true;
}

export async function unsubscribeNewsletter(token: string) {
  const sub = await prisma.newsletterSubscriber.findUnique({ where: { unsubToken: token } });
  if (!sub) return false;
  await prisma.newsletterSubscriber.update({ where: { id: sub.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  await prisma.marketingConsent.create({ data: { email: sub.email, channel: "email", purpose: "newsletter", granted: false, source: "unsubscribe-link" } });
  return true;
}
