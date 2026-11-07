import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { orderConfirmationEmail, refundEmail } from "@/lib/email/templates";
import { getSetting } from "@/lib/settings";
import { orderAccessUrl } from "./access";

export async function brandForEmail() {
  const brand = await getSetting("brand");
  const theme = await getSetting("theme");
  return { name: brand.name, appUrl: env.appUrl, contactEmail: brand.contactEmail, color: theme.colors.coral };
}

/** Email de confirmation + liens de téléchargement (après livraison). */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: true },
  });
  if (!order || !order.email) return;
  const brand = await brandForEmail();
  const accessUrl = orderAccessUrl(order.id);
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
  const brand = await brandForEmail();
  await sendEmail({ to: order.email, ...refundEmail(brand, { orderNumber: order.number, amountCents, currency: order.currency }) });
}
