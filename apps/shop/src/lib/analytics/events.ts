import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/db";

/**
 * Mesure d'audience interne (parcours d'achat). Anonyme et limitée à la mesure de ce site :
 *  - ni adresse IP, ni e-mail, ni lien avec la fiche client ou la commande ;
 *  - identifiant de visiteur aléatoire (renouvelé tous les 13 mois) et de visite (30 min d'inactivité) ;
 *  - robots exclus ; conservation 25 mois (purgeSiteEvents).
 * Cadre de la CNIL pour la mesure d'audience exemptée de consentement ; un visiteur qui refuse la
 * mesure d'audience dans le bandeau n'est pas compté (le navigateur n'envoie rien).
 */

export const CLIENT_EVENT_TYPES = ["page_view", "view_item", "add_to_cart", "begin_checkout"] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];
export const RETENTION_DAYS = 25 * 31;

const id = z.string().regex(/^[a-z0-9]{8,40}$/i);
export const clientEventSchema = z.object({
  type: z.enum(CLIENT_EVENT_TYPES),
  path: z.string().max(300).optional(),
  productId: z.string().max(40).optional(),
  value: z.number().finite().min(0).max(100_000).optional(), // en euros (côté navigateur)
  vid: id.optional(),
  sid: id.optional(),
  ref: z.string().max(500).optional(),
  utm: z.record(z.string(), z.string().max(120)).optional(),
});
export type ClientEvent = z.infer<typeof clientEventSchema>;

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|meta-externalagent|preview|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|node-fetch/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

export function deviceOf(userAgent: string | null | undefined): "mobile" | "tablet" | "desktop" {
  const ua = userAgent ?? "";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "mobile";
  return "desktop";
}

const SOURCE_BY_HOST: Array<[RegExp, string]> = [
  [/(^|\.)(facebook|fb)\.(com|me)$|^l\.facebook\.com$|^lm\.facebook\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)pinterest\./, "pinterest"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)etsy\.com$/, "etsy"],
  [/mail|outlook|gmail/, "e-mail"],
];

/**
 * Source d'une visite : paramètres utm en priorité, puis domaine du référent, sinon « direct ».
 * `fbclid` / `gclid` sans utm désignent Facebook / Google (clic sur une publicité).
 */
export function sourceOf(input: { ref?: string | null; utm?: Record<string, string> | null; path?: string | null; ownHost?: string | null }): { source: string; medium: string | null; campaign: string | null } {
  const utm = input.utm ?? {};
  const norm = (s: string | undefined) => (s ? s.trim().toLowerCase().slice(0, 60) : null);
  if (utm.utm_source) return { source: norm(utm.utm_source)!, medium: norm(utm.utm_medium), campaign: norm(utm.utm_campaign) };
  if (utm.fbclid) return { source: "facebook", medium: "paid", campaign: null };
  if (utm.gclid) return { source: "google", medium: "paid", campaign: null };
  if (input.ref) {
    try {
      const host = new URL(input.ref).hostname.replace(/^www\./, "").toLowerCase();
      const own = (input.ownHost ?? "").replace(/^www\./, "").toLowerCase();
      if (host && host !== own) {
        const known = SOURCE_BY_HOST.find(([re]) => re.test(host));
        return { source: known ? known[1] : host.slice(0, 60), medium: "referral", campaign: null };
      }
    } catch {
      /* référent illisible : direct */
    }
  }
  return { source: "direct", medium: null, campaign: null };
}

/** Chemin nettoyé : sans paramètres (pas de jeton ni d'identifiant dans les statistiques). */
export function cleanPath(path: string | undefined | null): string | null {
  if (!path) return null;
  const p = path.split("?")[0].split("#")[0].slice(0, 200);
  // Pages privées (jetons) : regroupées
  return p.replace(/^\/(commande|mes-achats)\/[^/]+.*/, "/$1/…");
}

export async function recordClientEvent(siteId: string, ev: ClientEvent, meta: { userAgent: string | null; ownHost?: string | null }, db: PrismaClient = defaultPrisma) {
  // Source calculée seulement pour la première page d'une visite (le navigateur n'envoie ref/utm qu'alors)
  const withSource = ev.type === "page_view" && (ev.ref !== undefined || ev.utm !== undefined);
  const src = withSource ? sourceOf({ ref: ev.ref, utm: ev.utm, path: ev.path, ownHost: meta.ownHost }) : { source: null, medium: null, campaign: null };
  await db.siteEvent.create({
    data: {
      siteId,
      type: ev.type,
      visitorId: ev.vid ?? null,
      sessionId: ev.sid ?? null,
      path: cleanPath(ev.path),
      productId: ev.productId ?? null,
      value: ev.value != null ? Math.round(ev.value * 100) : null,
      source: src.source,
      medium: src.medium,
      campaign: src.campaign,
      device: deviceOf(meta.userAgent),
    },
  });
}

/** Événements serveur (achat confirmé, paiement refusé) : sans visiteur, sans donnée client. */
export async function recordServerEvent(data: { siteId: string; type: "purchase" | "payment_failed"; value?: number | null; productId?: string | null; source?: string | null; detail?: string | null }, db: PrismaClient = defaultPrisma) {
  try {
    await db.siteEvent.create({ data: { siteId: data.siteId, type: data.type, value: data.value ?? null, productId: data.productId ?? null, source: data.source ?? null, detail: data.detail?.slice(0, 80) ?? null } });
  } catch (e) {
    console.error("[stats] événement serveur", e instanceof Error ? e.message : e);
  }
}

export async function purgeSiteEvents(db: PrismaClient = defaultPrisma, now = new Date()) {
  const r = await db.siteEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86400_000) } } });
  return r.count;
}
