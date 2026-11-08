import "server-only";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { orderConfirmationEmail, refundEmail } from "@/lib/email/templates";
import { emailBrandForSite } from "@/lib/sites/email";
import { orderAccessUrl } from "./access";

/** Identité de l'univers (nom, couleur, contact, domaine) pour les emails. */
export async function brandForEmail(siteId?: string | null) {
  return emailBrandForSite(siteId);
}

/** Email de confirmation + liens de téléchargement (après livraison). */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: true },
  });
  if (!order || !order.email) return;
  const brand = await brandForEmail(order.siteId);
  const accessUrl = orderAccessUrl(order.id, undefined, brand.appUrl);
  const mail = orderConfirmationEmail(brand, {
    orderNumber: order.number,
    customerName: order.billingName ?? order.customer?.name,
    items: order.items.map((it) => ({ name: it.name, quantity: it.quantity, totalCents: it.totalCents })),
    totalCents: order.totalCents,
    currency: order.currency,
    accessUrl,
    invoiceUrl: `${accessUrl}/facture`,
  });
  await sendEmail({ to: order.email, ...mail });
}

export async function sendRefundNotification(orderId: string, amountCents: number): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.email) return;
  const brand = await brandForEmail(order.siteId);
  await sendEmail({ to: order.email, ...refundEmail(brand, { orderNumber: order.number, amountCents, currency: order.currency }) });
}
