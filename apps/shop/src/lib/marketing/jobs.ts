import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { abandonedCartEmail, newProductEmail } from "@/lib/email/templates";
import { getSetting } from "@/lib/settings";
import { sendPurchaseConversions } from "@/lib/social/conversions";
import { runSocialJobs } from "@/lib/social/jobs";
import { runEtsyJobs } from "@/lib/channels/etsy";
import { emailBrandForSite } from "@/lib/sites/email";

export interface Brand { name: string; appUrl: string; contactEmail?: string | null; color?: string }

export interface ConsentRecord { purpose: string; granted: boolean; createdAt: Date }

/**
 * Détermine si un email peut recevoir une relance commerciale : le dernier
 * consentement enregistré pour « promotions » ou « newsletter » doit être
 * accordé, et l'abonné ne doit pas être désinscrit.
 */
export function canReceiveMarketing(consents: ConsentRecord[], subscriberStatus: string | null | undefined): boolean {
  if (subscriberStatus === "UNSUBSCRIBED") return false;
  const relevant = consents
    .filter((c) => c.purpose === "promotions" || c.purpose === "newsletter")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (relevant.length === 0) return subscriberStatus === "CONFIRMED";
  return relevant[0].granted;
}

/** Une commande en attente est « abandonnée » après le délai configuré, si elle a un email et n'a pas déjà été relancée. */
export function isAbandoned(order: { status: string; email: string; createdAt: Date; abandonedEmailSentAt: Date | null }, delayMinutes: number, now = new Date()): boolean {
  if (order.status !== "PENDING" || !order.email || order.abandonedEmailSentAt) return false;
  return now.getTime() - order.createdAt.getTime() >= delayMinutes * 60_000;
}

/** Identité (nom, couleur, domaine) de l'univers concerné, pour les emails. */
async function brand(siteId?: string | null): Promise<Brand> {
  const b = await emailBrandForSite(siteId);
  return { name: b.name, appUrl: b.appUrl, contactEmail: b.contactEmail, color: b.color };
}

/** (a) Relance des paniers abandonnés. */
export async function processAbandonedCarts(db: PrismaClient = defaultPrisma, now = new Date()): Promise<{ sent: number; skipped: number }> {
  const commerce = await getSetting("commerce");
  if (!commerce.abandonedCartEmailsEnabled) return { sent: 0, skipped: 0 };
  const cutoff = new Date(now.getTime() - commerce.abandonedCartDelayMinutes * 60_000);
  const orders = await db.order.findMany({
    where: { status: "PENDING", email: { not: "" }, abandonedEmailSentAt: null, createdAt: { lte: cutoff, gte: new Date(now.getTime() - 7 * 24 * 3600_000) } },
    include: { items: true },
    take: 100,
  });
  let sent = 0;
  let skipped = 0;
  for (const order of orders) {
    const b = await brand(order.siteId);
    if (!isAbandoned(order, commerce.abandonedCartDelayMinutes, now)) { skipped++; continue; }
    const [consents, sub] = await Promise.all([
      db.marketingConsent.findMany({ where: { email: order.email }, select: { purpose: true, granted: true, createdAt: true } }),
      db.newsletterSubscriber.findUnique({ where: { siteId_email: { siteId: order.siteId, email: order.email } }, select: { status: true, unsubToken: true } }),
    ]);
    if (!canReceiveMarketing(consents, sub?.status)) { skipped++; continue; }
    const unsubscribeUrl = sub ? `${b.appUrl}/newsletter/desinscription/${sub.unsubToken}` : `${b.appUrl}/pages/confidentialite`;
    const mail = abandonedCartEmail(b, { items: order.items.map((i) => i.name), resumeUrl: `${b.appUrl}/panier`, unsubscribeUrl });
    const res = await sendEmail({ to: order.email, ...mail });
    if (res.ok) {
      await db.order.update({ where: { id: order.id }, data: { abandonedEmailSentAt: now } });
      await db.marketingEvent.create({ data: { type: "cart.abandoned", email: order.email, payload: { orderId: order.id, items: order.items.map((i) => i.name) }, processedAt: now } });
      sent++;
    } else {
      skipped++;
    }
  }
  return { sent, skipped };
}

/** (b) Annonce des nouveaux produits publiés aux abonnés confirmés (max 200 emails par exécution). */
export async function processProductPublishedEvents(db: PrismaClient = defaultPrisma, now = new Date(), maxEmails = 200): Promise<{ events: number; emails: number }> {
  const events = await db.marketingEvent.findMany({ where: { type: "product.published", processedAt: null }, orderBy: { createdAt: "asc" }, take: 5 });
  if (events.length === 0) return { events: 0, emails: 0 };
  let emails = 0;
  let processed = 0;
  for (const ev of events) {
    const payload = (ev.payload ?? {}) as { productId?: string; slug?: string; name?: string };
    if (!payload.productId) { await db.marketingEvent.update({ where: { id: ev.id }, data: { processedAt: now, error: "payload invalide" } }); processed++; continue; }
    const product = await db.product.findUnique({ where: { id: payload.productId }, select: { name: true, slug: true, tagline: true, status: true, siteId: true } });
    if (!product || product.status !== "PUBLISHED") { await db.marketingEvent.update({ where: { id: ev.id }, data: { processedAt: now, error: "produit non publié" } }); processed++; continue; }
    const b = await brand(product.siteId);
    // Annonce limitée aux abonnés de l'univers du produit
    const subscribers = await db.newsletterSubscriber.findMany({ where: { status: "CONFIRMED", siteId: product.siteId }, select: { email: true, unsubToken: true }, take: Math.max(0, maxEmails - emails) });
    if (emails + subscribers.length > maxEmails && subscribers.length === 0) break;
    for (const s of subscribers) {
      const mail = newProductEmail(b, { productName: product.name, productUrl: `${b.appUrl}/aventures/${product.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=nouveaute`, tagline: product.tagline, unsubscribeUrl: `${b.appUrl}/newsletter/desinscription/${s.unsubToken}` });
      await sendEmail({ to: s.email, ...mail });
      emails++;
    }
    await db.marketingEvent.update({ where: { id: ev.id }, data: { processedAt: now } });
    processed++;
    if (emails >= maxEmails) break;
  }
  return { events: processed, emails };
}

/** (c) Conversions serveur (Meta CAPI, TikTok Events) pour les commandes payées non encore traitées. */
export async function processOrderPaidEvents(db: PrismaClient = defaultPrisma, now = new Date(), max = 100): Promise<{ events: number; sent: number }> {
  const events = await db.marketingEvent.findMany({ where: { type: "order.paid", processedAt: null }, orderBy: { createdAt: "asc" }, take: max });
  let sent = 0;
  for (const ev of events) {
    const payload = (ev.payload ?? {}) as { orderId?: string };
    let error: string | undefined;
    if (payload.orderId) {
      const r = await sendPurchaseConversions(payload.orderId, db);
      if (r.meta === "SENT" || r.tiktok === "SENT") sent++;
      if (r.meta === "FAILED" || r.tiktok === "FAILED") error = "conversion en échec (voir ConversionEvent)";
    } else error = "payload invalide";
    await db.marketingEvent.update({ where: { id: ev.id }, data: { processedAt: now, error } });
  }
  return { events: events.length, sent };
}

export async function runMarketingJobs(db: PrismaClient = defaultPrisma) {
  const abandoned = await processAbandonedCarts(db);
  const published = await processProductPublishedEvents(db);
  const conversions = await processOrderPaidEvents(db);
  const social = await runSocialJobs(db);
  // Etsy : rafraîchissement des jetons, synchro des fiches, import des ventes (une fois par jour sur Vercel Hobby)
  const etsy = await runEtsyJobs(db).catch((e: unknown) => ({ refreshed: 0, synced: 0, imported: 0, errors: [e instanceof Error ? e.message : String(e)] }));
  if (etsy.errors.length) console.warn("[cron:etsy]", etsy.errors);
  return { abandoned, published, conversions, social, etsy };
}
