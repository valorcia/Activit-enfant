import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { sha256Normalized } from "@/lib/crypto";
import { getSetting } from "@/lib/settings";
import { getSecrets } from "@/lib/integrations/secrets";
import { siteBaseUrl } from "@/lib/sites/host";

/**
 * Envoi serveur des achats aux API de conversion (Meta Conversions API, TikTok
 * Events API). Déduplication avec le pixel navigateur via event_id = id de commande.
 * Idempotent : une ligne ConversionEvent (orderId, provider, eventName) par envoi réussi.
 */

export interface PurchasePayload {
  orderId: string;
  email: string | null;
  valueCents: number;
  currency: string;
  contentIds: string[];
  eventTime: Date;
  sourceUrl: string;
}

export function metaPurchaseBody(p: PurchasePayload, pixelId: string, testEventCode?: string | null) {
  return {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(p.eventTime.getTime() / 1000),
      event_id: p.orderId,
      action_source: "website",
      event_source_url: p.sourceUrl,
      user_data: { em: p.email ? [sha256Normalized(p.email)] : undefined },
      custom_data: { currency: p.currency.toUpperCase(), value: p.valueCents / 100, content_ids: p.contentIds, content_type: "product" },
    }],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
    pixel_id: pixelId,
  };
}

export function tiktokPurchaseBody(p: PurchasePayload, pixelCode: string) {
  return {
    event_source: "web",
    event_source_id: pixelCode,
    data: [{
      event: "CompletePayment",
      event_time: Math.floor(p.eventTime.getTime() / 1000),
      event_id: p.orderId,
      user: { email: p.email ? sha256Normalized(p.email) : undefined },
      page: { url: p.sourceUrl },
      properties: { currency: p.currency.toUpperCase(), value: p.valueCents / 100, content_type: "product", contents: p.contentIds.map((id) => ({ content_id: id, quantity: 1 })) },
    }],
  };
}

async function sendMeta(p: PurchasePayload, pixelId: string, token: string): Promise<unknown> {
  const body = metaPurchaseBody(p, pixelId);
  const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: body.data, ...(body.test_event_code ? { test_event_code: body.test_event_code } : {}) }), cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meta CAPI ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function sendTikTok(p: PurchasePayload, pixelCode: string, token: string): Promise<unknown> {
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
    method: "POST", headers: { "content-type": "application/json", "Access-Token": token }, body: JSON.stringify(tiktokPurchaseBody(p, pixelCode)), cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
  if (!res.ok || (json.code !== undefined && json.code !== 0)) throw new Error(`TikTok Events ${res.status}: ${json.message ?? ""}`);
  return json;
}

/** Envoie l'achat aux plateformes configurées. Ne renvoie jamais d'erreur (journalisée en base). */
export async function sendPurchaseConversions(orderId: string, db: PrismaClient = defaultPrisma): Promise<{ meta?: "SENT" | "FAILED" | "SKIPPED"; tiktok?: "SENT" | "FAILED" | "SKIPPED" }> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { select: { productId: true, bundleId: true } }, conversions: true } });
  if (!order || !order.paidAt) return {};
  // Pixel et domaine de l'univers de la commande
  const analytics = await getSetting("analytics", order.siteId);
  const site = await db.site.findUnique({ where: { id: order.siteId }, select: { primaryDomain: true, domains: true } });
  const appUrl = siteBaseUrl(site ?? { primaryDomain: null, domains: [] }, process.env.NEXT_PUBLIC_APP_URL ?? "");
  const payload: PurchasePayload = {
    orderId: order.id, email: order.email || null, valueCents: order.totalCents, currency: order.currency,
    contentIds: order.items.map((i) => i.productId ?? i.bundleId ?? "").filter(Boolean), eventTime: order.paidAt, sourceUrl: `${appUrl}/commande/confirmation`,
  };
  const result: { meta?: "SENT" | "FAILED" | "SKIPPED"; tiktok?: "SENT" | "FAILED" | "SKIPPED" } = {};

  const run = async (provider: "META" | "TIKTOK", enabled: boolean, send: () => Promise<unknown>) => {
    if (!enabled) return "SKIPPED" as const;
    if (order.conversions.some((c) => c.provider === provider && c.status === "SENT")) return "SENT" as const;
    try {
      const response = await send();
      await db.conversionEvent.upsert({ where: { orderId_provider_eventName: { orderId, provider, eventName: "Purchase" } }, create: { orderId, provider, eventName: "Purchase", status: "SENT", response: response as object }, update: { status: "SENT", response: response as object } });
      return "SENT" as const;
    } catch (e) {
      await db.conversionEvent.upsert({ where: { orderId_provider_eventName: { orderId, provider, eventName: "Purchase" } }, create: { orderId, provider, eventName: "Purchase", status: "FAILED", response: { error: String(e) } }, update: { status: "FAILED", response: { error: String(e) } } });
      return "FAILED" as const;
    }
  };

  // Jetons : Intégrations (prioritaire), sinon paramètres Analytics (compatibilité)
  const secrets = await getSecrets(["meta.capiToken", "tiktok.eventsToken"]);
  const metaToken = secrets["meta.capiToken"] || analytics.metaCapiToken || "";
  const tiktokToken = secrets["tiktok.eventsToken"] || analytics.tiktokEventsToken || "";
  result.meta = await run("META", Boolean(analytics.metaPixelId && metaToken), () => sendMeta(payload, analytics.metaPixelId as string, metaToken));
  result.tiktok = await run("TIKTOK", Boolean(analytics.tiktokPixelId && tiktokToken), () => sendTikTok(payload, analytics.tiktokPixelId as string, tiktokToken));
  return result;
}
