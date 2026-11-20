import "server-only";
import webpush from "web-push";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { roleCan } from "@/lib/auth/permissions";
import { getSecrets, setSecret } from "@/lib/integrations/secrets";
import { formatPrice } from "@/lib/utils";

/**
 * Notifications push de l'équipe (Web Push, standard des navigateurs, sans service tiers payant).
 *  - Clés VAPID générées automatiquement à la première activation et stockées chiffrées avec
 *    les autres secrets (Intégrations) ; jamais affichées.
 *  - Un abonnement par appareil (table PushSubscription) ; supprimé si le navigateur le déclare
 *    expiré (404/410) ou après 5 échecs consécutifs.
 *  - iPhone : nécessite iOS 16.4+ et l'admin ajoutée à l'écran d'accueil.
 * Contenu des notifications : numéro, montant et produits, jamais l'adresse e-mail du client
 * (elles peuvent s'afficher sur un écran verrouillé).
 */

export interface PushPayload { title: string; body: string; url: string; tag?: string }

export async function vapidKeys(db: PrismaClient = defaultPrisma): Promise<{ publicKey: string; privateKey: string }> {
  const s = await getSecrets(["push.vapidPublicKey", "push.vapidPrivateKey"], db);
  if (s["push.vapidPublicKey"] && s["push.vapidPrivateKey"]) return { publicKey: s["push.vapidPublicKey"], privateKey: s["push.vapidPrivateKey"] };
  const keys = webpush.generateVAPIDKeys();
  await setSecret("push.vapidPrivateKey", keys.privateKey, { actor: "system" }, db);
  await setSecret("push.vapidPublicKey", keys.publicKey, { actor: "system" }, db);
  return keys;
}

function subject(): string {
  try {
    return new URL(env.appUrl).origin;
  } catch {
    return "mailto:contact@lamalleajeux.eu";
  }
}

/** Envoie une notification à une liste d'abonnements ; nettoie ceux qui ont expiré. */
export async function sendToSubscriptions(subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>, payload: PushPayload, db: PrismaClient = defaultPrisma) {
  if (!subs.length) return { sent: 0, removed: 0 };
  const { publicKey, privateKey } = await vapidKeys(db);
  let sent = 0;
  let removed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { vapidDetails: { subject: subject(), publicKey, privateKey }, TTL: 24 * 3600, urgency: "high", timeout: 5000 });
      sent += 1;
      await db.pushSubscription.update({ where: { id: s.id }, data: { lastSuccessAt: new Date(), failures: 0 } });
    } catch (e) {
      const status = typeof e === "object" && e && "statusCode" in e ? Number((e as { statusCode: number }).statusCode) : 0;
      if (status === 404 || status === 410) {
        await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        removed += 1;
      } else {
        const row = await db.pushSubscription.update({ where: { id: s.id }, data: { failures: { increment: 1 } } }).catch(() => null);
        if (row && row.failures >= 5) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
          removed += 1;
        }
        console.warn("[push] envoi échoué", status || (e instanceof Error ? e.message : e));
      }
    }
  }));
  return { sent, removed };
}

/** Notifie tous les membres de l'équipe autorisés à voir les commandes. Ne lève jamais d'erreur. */
export async function notifyStaff(payload: PushPayload, db: PrismaClient = defaultPrisma) {
  try {
    const subs = await db.pushSubscription.findMany({ include: { user: { select: { role: true, isActive: true } } } });
    const allowed = subs.filter((s) => s.user.isActive && roleCan(s.user.role, "orders:read"));
    return await sendToSubscriptions(allowed, payload, db);
  } catch (e) {
    console.error("[push] notification de l'équipe", e instanceof Error ? e.message : e);
    return { sent: 0, removed: 0 };
  }
}

/** Notification « nouvelle commande » (après confirmation du paiement). */
export async function notifyNewOrder(orderId: string, db: PrismaClient = defaultPrisma) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, totalCents: true, currency: true, items: { select: { name: true, quantity: true } }, site: { select: { name: true } } } });
  if (!order) return { sent: 0, removed: 0 };
  const names = order.items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name));
  const body = `${formatPrice(order.totalCents, order.currency)} · ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` et ${names.length - 2} autre(s)` : ""}`;
  return notifyStaff({ title: `Nouvelle commande ${order.number}`, body: order.site?.name ? `${body} · ${order.site.name}` : body, url: `/admin/commandes/${order.id}`, tag: `order-${order.id}` }, db);
}
