import "server-only";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { downloadUrl } from "@/lib/orders/access";
import { asLocale } from "./i18n";
import { brandForEmail, brandHref, brandUrl, orderTrackToken } from "./brand";
import { bookReadyEmail, giftInviteEmail, personalOrderEmail, resumeEmail } from "./emails";
import { rotateGiftToken } from "./orders";
import { href } from "./i18n/routing";

/**
 * Envoi des e-mails UNWRITTEN. Journalisation sans donnée personnelle : identifiants techniques seulement.
 */

function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : null;
}

/** Remplace la confirmation de La Malle à Jeux pour une commande de livres personnalisés. */
export async function sendPersonalOrderConfirmation(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, personalItems: { include: { gift: true, product: { select: { name: true } } } } } });
  if (!order?.email) return;
  const { site, config, brand } = await brandForEmail(order.siteId);
  const locale = asLocale(order.personalItems[0]?.locale ?? (order.metadata as { locale?: string } | null)?.locale);
  const trackUrl = brandHref(site, locale, "order", orderTrackToken(order.id));
  const gifts: Array<{ recipientName: string | null; sentToRecipient: boolean; link: string | null }> = [];
  for (const item of order.personalItems) {
    if (item.status !== "AWAITING_RECIPIENT" || !item.gift || item.gift.sentAt) continue;
    try {
      const { token, claim } = await rotateGiftToken(item.id);
      const link = brandHref(site, asLocale(item.locale), "gift", token);
      if (claim.recipientEmail && !claim.sendAt) {
        await sendEmail({ to: claim.recipientEmail, ...giftInviteEmail(brand, asLocale(item.locale), { from: firstName(order.billingName), product: item.product?.name ?? "UNWRITTEN", message: claim.message, url: link, validityDays: config.giftLinkValidityDays }) });
        gifts.push({ recipientName: claim.recipientName, sentToRecipient: true, link: null });
      } else {
        gifts.push({ recipientName: claim.recipientName, sentToRecipient: false, link });
      }
    } catch (e) {
      console.error(`[unwritten] lien cadeau non émis pour le livre ${item.id}`, e instanceof Error ? e.message : e);
    }
  }
  await sendEmail({
    to: order.email,
    ...personalOrderEmail(brand, locale, { number: order.number, items: order.items.map((i) => ({ name: i.name, totalCents: i.totalCents })), totalCents: order.totalCents, currency: order.currency, trackUrl, gifts }),
  });
}

/** Relance (admin) : nouveau lien au destinataire si son adresse est connue, sinon à l'acheteur. */
export async function resendGiftLink(personalItemId: string): Promise<"recipient" | "buyer"> {
  const item = await prisma.personalOrderItem.findUniqueOrThrow({ where: { id: personalItemId }, include: { order: true, product: { select: { name: true } } } });
  const { site, config, brand } = await brandForEmail(item.siteId);
  const locale = asLocale(item.locale);
  const { token, claim } = await rotateGiftToken(item.id);
  const link = brandHref(site, locale, "gift", token);
  if (claim.recipientEmail) {
    await sendEmail({ to: claim.recipientEmail, ...giftInviteEmail(brand, locale, { from: firstName(item.order.billingName), product: item.product?.name ?? "UNWRITTEN", message: claim.message, url: link, validityDays: config.giftLinkValidityDays }) });
    await prisma.personalOrderItem.update({ where: { id: item.id }, data: { remindedAt: new Date() } });
    return "recipient";
  }
  await sendEmail({ to: item.order.email, ...personalOrderEmail(brand, locale, { number: item.order.number, items: [], totalCents: item.order.totalCents, currency: item.order.currency, trackUrl: brandHref(site, locale, "order", orderTrackToken(item.orderId)), gifts: [{ recipientName: claim.recipientName, sentToRecipient: false, link }] }) });
  await prisma.personalOrderItem.update({ where: { id: item.id }, data: { remindedAt: new Date() } });
  return "buyer";
}

export async function sendResumeLinkEmail(opts: { to: string; siteId: string; locale: string; productName: string; url: string; validityHours: number }) {
  const { brand } = await brandForEmail(opts.siteId);
  return sendEmail({ to: opts.to, ...resumeEmail(brand, asLocale(opts.locale), { product: opts.productName, url: opts.url, validityHours: opts.validityHours }) });
}

/** Livraison : lien de téléchargement à l'acheteur, et au destinataire s'il a rempli lui-même le cadeau. */
export async function sendBookReady(personalItemId: string): Promise<void> {
  const item = await prisma.personalOrderItem.findUniqueOrThrow({ where: { id: personalItemId }, include: { order: true, entitlement: true, gift: true, product: { select: { name: true } } } });
  if (!item.entitlement) return;
  const { site, brand } = await brandForEmail(item.siteId);
  const locale = asLocale(item.locale);
  const base = brandUrl(site, "/").replace(/\/\?.*$/, "").replace(/\/$/, "");
  const dl = downloadUrl(item.entitlement.token, item.id, base);
  const product = item.product?.name ?? "UNWRITTEN";
  const trackUrl = brandUrl(site, href(locale, "order", orderTrackToken(item.orderId)));
  if (item.order.email) await sendEmail({ to: item.order.email, ...bookReadyEmail(brand, locale, { product, downloadUrl: dl, trackUrl }) });
  if (item.mode === "gift_recipient" && item.gift?.recipientEmail) {
    await sendEmail({ to: item.gift.recipientEmail, ...bookReadyEmail(brand, locale, { product, downloadUrl: dl, trackUrl: null }) });
  }
}
