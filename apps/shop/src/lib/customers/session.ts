import "server-only";
import { cookies } from "next/headers";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyOrderAccessToken } from "@/lib/orders/access";
import { env } from "@/lib/env";
import { signPayload, verifySignedPayload } from "@/lib/tokens";

/**
 * Compte client sans mot de passe : le client est « reconnu » sur son appareil par un cookie
 * httpOnly signé (6 mois), posé après un paiement confirmé, à l'ouverture du lien de sa commande
 * ou d'un lien d'accès reçu par e-mail. Sur un autre appareil, il demande un lien par e-mail.
 * Aucune création de compte forcée : la fiche client existe déjà (créée au paiement).
 */
export const CUSTOMER_COOKIE = "cc_customer";
export const CUSTOMER_SESSION_DAYS = 180;

export function signCustomerSession(customerId: string, now = Date.now()): string {
  return signPayload(`customer:${customerId}`, Math.floor(now / 1000) + CUSTOMER_SESSION_DAYS * 86400);
}

export function verifyCustomerSession(token: string | null | undefined): string | null {
  if (!token) return null;
  const payload = verifySignedPayload(token);
  return payload?.startsWith("customer:") ? payload.slice("customer:".length) : null;
}

export async function setCustomerSession(customerId: string) {
  (await cookies()).set(CUSTOMER_COOKIE, signCustomerSession(customerId), { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge: CUSTOMER_SESSION_DAYS * 86400 });
}

export async function clearCustomerSession() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

/** Client reconnu sur cet appareil (ou null). */
export async function currentCustomer() {
  const id = verifyCustomerSession((await cookies()).get(CUSTOMER_COOKIE)?.value);
  if (!id) return null;
  return prisma.customer.findUnique({ where: { id } });
}

export type RememberInput = { kind: "session"; sessionId: string } | { kind: "order"; token: string } | { kind: "access"; token: string };

const PAID = ["PAID", "PARTIALLY_REFUNDED"];
/** Une page de confirmation (session Stripe) ne connecte le client que peu après le paiement. */
export const CONFIRMATION_WINDOW_MS = 24 * 3600 * 1000;

/** Client correspondant à une preuve d'accès valide (ou null). */
export async function customerFromProof(input: RememberInput, db: PrismaClient = prisma, now = new Date()): Promise<string | null> {
  if (input.kind === "session") {
    const order = await db.order.findUnique({ where: { stripeCheckoutSessionId: String(input.sessionId).slice(0, 200) }, select: { status: true, paidAt: true, customerId: true } });
    if (order && PAID.includes(order.status) && order.paidAt && now.getTime() - order.paidAt.getTime() < CONFIRMATION_WINDOW_MS) return order.customerId;
    return null;
  }
  if (input.kind === "order") {
    const orderId = verifyOrderAccessToken(String(input.token));
    const order = orderId ? await db.order.findUnique({ where: { id: orderId }, select: { status: true, customerId: true } }) : null;
    return order && PAID.includes(order.status) ? order.customerId : null;
  }
  const link = await db.accessLink.findUnique({ where: { token: String(input.token) }, select: { customerId: true, expiresAt: true } });
  return link && link.expiresAt > now ? link.customerId : null;
}
