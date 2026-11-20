"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { sendToSubscriptions, vapidKeys } from "@/lib/push";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(8).max(100) }),
});

/** Clé publique pour l'abonnement du navigateur (générée à la première demande). */
export async function pushPublicKeyAction(): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  try {
    await assertPermission("orders:read");
    return { ok: true, key: (await vapidKeys()).publicKey };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

/** Enregistre l'abonnement de cet appareil pour l'utilisateur connecté. */
export async function savePushSubscriptionAction(raw: unknown, deviceLabel: string): Promise<Result> {
  try {
    const user = await assertPermission("orders:read");
    const sub = subscriptionSchema.parse(raw);
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, deviceLabel: deviceLabel.slice(0, 80) || null },
      update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, deviceLabel: deviceLabel.slice(0, 80) || null, failures: 0 },
    });
    revalidatePath("/admin/notifications");
    return { ok: true, message: "Notifications activées sur cet appareil" };
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? "Abonnement invalide" : e instanceof Error ? e.message : "Erreur" };
  }
}

/** Retire un appareil (le sien, ou n'importe lequel pour un administrateur). */
export async function removePushSubscriptionAction(input: { id?: string; endpoint?: string }): Promise<Result> {
  try {
    const user = await assertPermission("orders:read");
    const row = input.id ? await prisma.pushSubscription.findUnique({ where: { id: input.id } }) : input.endpoint ? await prisma.pushSubscription.findUnique({ where: { endpoint: input.endpoint } }) : null;
    if (!row) return { ok: true };
    if (row.userId !== user.id && user.role !== "ADMIN") return { ok: false, error: "Cet appareil appartient à un autre membre de l'équipe" };
    await prisma.pushSubscription.delete({ where: { id: row.id } });
    revalidatePath("/admin/notifications");
    return { ok: true, message: "Appareil retiré" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

/** Notification d'essai vers les appareils de l'utilisateur connecté. */
export async function testPushAction(): Promise<Result> {
  try {
    const user = await assertPermission("orders:read");
    const subs = await prisma.pushSubscription.findMany({ where: { userId: user.id } });
    if (!subs.length) return { ok: false, error: "Aucun appareil abonné pour votre compte" };
    const r = await sendToSubscriptions(subs, { title: "Notification d'essai", body: "Les nouvelles commandes s'afficheront ainsi sur cet appareil.", url: "/admin/notifications", tag: "test" });
    revalidatePath("/admin/notifications");
    return r.sent ? { ok: true, message: `Notification envoyée à ${r.sent} appareil(s)` } : { ok: false, error: "L'envoi a échoué : réactivez les notifications sur cet appareil" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}
