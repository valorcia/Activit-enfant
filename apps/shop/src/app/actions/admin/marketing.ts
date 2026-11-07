"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";

export async function markMarketingEventProcessedAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPermission("newsletter:read");
    await prisma.marketingEvent.update({ where: { id }, data: { processedAt: new Date() } });
    revalidatePath("/admin/newsletter/evenements");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}

export async function unsubscribeSubscriberAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPermission("newsletter:read");
    const sub = await prisma.newsletterSubscriber.update({ where: { id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
    await prisma.marketingConsent.create({ data: { email: sub.email, channel: "email", purpose: "newsletter", granted: false, source: "admin" } });
    revalidatePath("/admin/newsletter");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}
