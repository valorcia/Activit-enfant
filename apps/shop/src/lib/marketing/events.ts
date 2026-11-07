import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type MarketingEventType =
  | "subscriber.created"
  | "subscriber.confirmed"
  | "order.paid"
  | "cart.abandoned"
  | "product.published"
  | "review.approved"
  | "followup.allowed";

/**
 * File d'événements marketing (outbox). Les intégrations (Brevo, Klaviyo,
 * Mailchimp, Zapier…) peuvent consommer /api/admin/marketing/events ou être
 * branchées dans processMarketingEvents().
 */
export async function emitMarketingEvent(type: MarketingEventType, email: string | null, payload?: Prisma.InputJsonValue) {
  return prisma.marketingEvent.create({ data: { type, email, payload } });
}
