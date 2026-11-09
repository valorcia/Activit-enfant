import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { EtsyListing, Prisma, PrismaClient, SocialAccount } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getSecrets } from "@/lib/integrations/secrets";
import { getSetting } from "@/lib/settings";
import type { EtsySettings } from "@/lib/schemas/settings";
import { getStorage } from "@/lib/storage";
import {
  buildEtsyListing, estimateEtsyFeesCents, etsyMoneyToCents, sourcesHash,
  ETSY_MAX_FILE_BYTES, ETSY_MAX_FILES, ETSY_MAX_IMAGES, ETSY_QUANTITY,
  type EtsyKitItem, type EtsyListingDraft, type EtsyOverrides, type EtsySourceProduct,
} from "./etsy-listing";

/**
 * Connecteur Etsy (Open API v3) : OAuth 2.0 avec PKCE, publication des e-books
 * en produits numériques, synchronisation des fiches et import des ventes.
 *
 * Points d'API utilisés (https://developers.etsy.com/documentation/) :
 *  - OAuth : https://www.etsy.com/oauth/connect, POST https://api.etsy.com/v3/public/oauth/token
 *  - GET /users/me, GET /shops/{shop_id}
 *  - POST /shops/{shop_id}/listings (createDraftListing), PATCH /shops/{shop_id}/listings/{listing_id} (updateListing)
 *  - PUT /listings/{listing_id}/inventory (prix), GET /listings/{listing_id}
 *  - POST|DELETE /shops/{shop_id}/listings/{listing_id}/images, …/files
 *  - GET /shops/{shop_id}/receipts, GET /seller-taxonomy/nodes, GET /openapi-ping
 */

export const ETSY_API = "https://openapi.etsy.com/v3/application";
export const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
export const ETSY_AUTH_URL = "https://www.etsy.com/oauth/connect";
export const ETSY_SCOPES = ["listings_r", "listings_w", "listings_d", "shops_r", "transactions_r"];
export const ETSY_PKCE_COOKIE = "etsy_pkce";

export class EtsyError extends Error {
  constructor(message: string, public status?: number, public code?: string, public reconnect = false) {
    super(message);
  }
}
export class EtsyNotConnectedError extends EtsyError {
  constructor(message = "Aucune boutique Etsy connectée pour cet univers : connectez-la dans Marketing social → Connecteurs.") {
    super(message, 409, "etsy_not_connected");
  }
}

// ---------------------------------------------------------------------------
// Identifiants de l'application et en-tête x-api-key
// ---------------------------------------------------------------------------

export async function etsyAppCredentials(): Promise<{ keystring: string; sharedSecret: string }> {
  const s = await getSecrets(["etsy.apiKey", "etsy.sharedSecret"]);
  return { keystring: s["etsy.apiKey"] ?? "", sharedSecret: s["etsy.sharedSecret"] ?? "" };
}

export async function isEtsyConfigured(): Promise<boolean> {
  return Boolean((await etsyAppCredentials()).keystring);
}

/**
 * Etsy a annoncé que l'en-tête x-api-key doit contenir « keystring:shared_secret ».
 * On envoie ce format quand le shared secret est connu, et l'on bascule une fois
 * sur le format historique (keystring seul) si Etsy le refuse.
 */
let apiKeyMode: "combined" | "keystring" | null = null;

function apiKeyHeaderValue(creds: { keystring: string; sharedSecret: string }, mode: "combined" | "keystring"): string {
  return mode === "combined" && creds.sharedSecret ? `${creds.keystring}:${creds.sharedSecret}` : creds.keystring;
}

// ---------------------------------------------------------------------------
// Requêtes : quota (≈ 10 requêtes/s), relances sur 429 et 5xx
// ---------------------------------------------------------------------------

let lastCall = 0;
let queue: Promise<void> = Promise.resolve();
const MIN_GAP_MS = 110;

function throttle(): Promise<void> {
  const next = queue.then(async () => {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
  });
  queue = next.catch(() => undefined);
  return next;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: FetchLike = (input, init) => fetch(input, init);
/** Tests : remplace fetch (et désactive l'attente entre requêtes). */
export function __setEtsyFetch(f: FetchLike | null) {
  fetchImpl = f ?? ((input, init) => fetch(input, init));
  apiKeyMode = null;
}

async function errorText(res: Response): Promise<{ message: string; json: Record<string, unknown> }> {
  const text = await res.text().catch(() => "");
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* texte brut */ }
  const msg = (json.error_description as string) ?? (json.error as string) ?? (text || res.statusText);
  return { message: String(msg).slice(0, 400), json };
}

interface EtsyRequest {
  method?: string;
  path: string;              // relatif à ETSY_API, ou URL absolue
  token?: string | null;     // jeton OAuth (Bearer)
  json?: unknown;
  form?: FormData;
  query?: Record<string, string | number | undefined>;
}

export async function etsyRequest<T = Record<string, unknown>>(req: EtsyRequest): Promise<T> {
  const creds = await etsyAppCredentials();
  if (!creds.keystring) throw new EtsyError("Application Etsy non configurée : renseignez la keystring et le shared secret dans Paramètres → Intégrations.", 500, "etsy_not_configured");
  const url = new URL(req.path.startsWith("http") ? req.path : `${ETSY_API}${req.path}`);
  for (const [k, v] of Object.entries(req.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const modes: Array<"combined" | "keystring"> = apiKeyMode ? [apiKeyMode] : creds.sharedSecret ? ["combined", "keystring"] : ["keystring"];
  let lastError: EtsyError | null = null;
  for (const mode of modes) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await throttle();
      const headers: Record<string, string> = { "x-api-key": apiKeyHeaderValue(creds, mode), accept: "application/json" };
      if (req.token) headers.authorization = `Bearer ${req.token}`;
      let body: BodyInit | undefined;
      if (req.form) body = req.form;
      else if (req.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(req.json); }
      const res = await fetchImpl(url.toString(), { method: req.method ?? "GET", headers, body, cache: "no-store" } as RequestInit);
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
        lastError = new EtsyError(`Etsy indisponible (${res.status})`, res.status);
        if (attempt < 3) { await new Promise((r) => setTimeout(r, Math.min(delay, 8000))); continue; }
        throw lastError;
      }
      if (!res.ok) {
        const { message } = await errorText(res);
        const err = new EtsyError(`Etsy (${res.status}) : ${message}`, res.status, undefined, res.status === 401 && /token|expired|invalid_grant/i.test(message));
        // Format de clé refusé : on retente une fois avec l'autre format
        if ((res.status === 401 || res.status === 403) && /api key|x-api-key|keystring|shared secret/i.test(message) && modes.length > 1 && mode === modes[0]) {
          lastError = err;
          break;
        }
        throw err;
      }
      apiKeyMode = mode;
      if (res.status === 204) return {} as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    }
  }
  throw lastError ?? new EtsyError("Requête Etsy impossible");
}

// ---------------------------------------------------------------------------
// OAuth 2.0 + PKCE
// ---------------------------------------------------------------------------

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function etsyRedirectUri(): string {
  return `${env.appUrl}/api/admin/social/etsy/callback`;
}

export async function etsyAuthorizeUrl(state: string, challenge: string, redirectUri = etsyRedirectUri()): Promise<string> {
  const { keystring } = await etsyAppCredentials();
  const u = new URL(ETSY_AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", ETSY_SCOPES.join(" "));
  u.searchParams.set("client_id", keystring);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

interface TokenResponse { access_token: string; refresh_token: string; expires_in: number; token_type?: string }

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { keystring } = await etsyAppCredentials();
  await throttle();
  const res = await fetchImpl(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: keystring, ...params }).toString(),
    cache: "no-store",
  } as RequestInit);
  if (!res.ok) {
    const { message } = await errorText(res);
    throw new EtsyError(`Etsy refuse le jeton (${res.status}) : ${message}`, res.status, "token", res.status === 400 || res.status === 401);
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeEtsyCode(code: string, verifier: string, redirectUri = etsyRedirectUri()): Promise<TokenResponse> {
  return tokenRequest({ grant_type: "authorization_code", redirect_uri: redirectUri, code, code_verifier: verifier });
}

/** L'identifiant utilisateur Etsy préfixe le jeton d'accès (« 12345678.xxxx »). */
export function etsyUserIdFromToken(accessToken: string): string | null {
  const id = accessToken.split(".")[0];
  return /^\d+$/.test(id) ? id : null;
}

export interface EtsyShopInfo { shopId: string; userId: string; name: string; url: string | null; iconUrl: string | null; currency: string | null; loginName: string | null }

export async function fetchEtsyShop(accessToken: string): Promise<EtsyShopInfo> {
  const me = await etsyRequest<{ user_id: number; shop_id?: number | null; login_name?: string }>({ path: "/users/me", token: accessToken });
  if (!me.shop_id) throw new EtsyError("Ce compte Etsy n'a pas de boutique : ouvrez votre boutique sur Etsy puis reconnectez-la.", 400, "no_shop");
  const shop = await etsyRequest<{ shop_id: number; shop_name: string; url?: string; icon_url_fullxfull?: string | null; currency_code?: string }>({ path: `/shops/${me.shop_id}`, token: accessToken });
  return {
    shopId: String(shop.shop_id ?? me.shop_id),
    userId: String(me.user_id),
    name: shop.shop_name,
    url: shop.url ?? null,
    iconUrl: shop.icon_url_fullxfull ?? null,
    currency: shop.currency_code ?? null,
    loginName: me.login_name ?? null,
  };
}

/** Enregistre (ou met à jour) la boutique Etsy connectée, jetons chiffrés. */
export async function saveEtsyAccount(tokens: TokenResponse, shop: EtsyShopInfo, userId: string | null, db: PrismaClient = defaultPrisma): Promise<SocialAccount> {
  const data = {
    name: shop.name, username: shop.loginName, avatarUrl: shop.iconUrl,
    accessTokenEnc: encryptSecret(tokens.access_token), refreshTokenEnc: encryptSecret(tokens.refresh_token),
    tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000), scopes: ETSY_SCOPES,
    metadata: { userId: shop.userId, url: shop.url, currency: shop.currency } as Prisma.InputJsonValue,
    connectedById: userId, isActive: true, needsReconnect: false,
  };
  return db.socialAccount.upsert({
    where: { provider_kind_externalId: { provider: "ETSY", kind: "SHOP", externalId: shop.shopId } },
    create: { provider: "ETSY", kind: "SHOP", externalId: shop.shopId, ...data },
    update: data,
  });
}

/** Jeton d'accès valide (rafraîchi si nécessaire : jeton ≈ 1 h, jeton de rafraîchissement ≈ 90 jours). */
export async function etsyAccessToken(account: SocialAccount, db: PrismaClient = defaultPrisma, now = new Date(), force = false): Promise<string> {
  if (account.needsReconnect) throw new EtsyError("Boutique Etsy à reconnecter (autorisation expirée).", 401, "reconnect", true);
  const fresh = !force && account.tokenExpiresAt && account.tokenExpiresAt.getTime() - now.getTime() > 120_000;
  if (fresh) return decryptSecret(account.accessTokenEnc);
  if (!account.refreshTokenEnc) throw new EtsyError("Jeton Etsy expiré : reconnectez la boutique.", 401, "reconnect", true);
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptSecret(account.refreshTokenEnc) });
    await db.socialAccount.update({
      where: { id: account.id },
      data: { accessTokenEnc: encryptSecret(t.access_token), refreshTokenEnc: encryptSecret(t.refresh_token), tokenExpiresAt: new Date(now.getTime() + (t.expires_in ?? 3600) * 1000), needsReconnect: false },
    });
    return t.access_token;
  } catch (e) {
    if (e instanceof EtsyError && e.reconnect) await db.socialAccount.update({ where: { id: account.id }, data: { needsReconnect: true } });
    throw e;
  }
}

/** Bouton « Tester » (Intégrations) : vérifie la clé de l'application, sans compte connecté. */
export async function testEtsyApiKey(): Promise<{ ok: boolean; message: string }> {
  const creds = await etsyAppCredentials();
  if (!creds.keystring) return { ok: false, message: "La keystring Etsy manquant(e) : enregistrez-la d'abord." };
  try {
    const r = await etsyRequest<{ application_id?: number }>({ path: "/openapi-ping" });
    return { ok: true, message: `Connexion Etsy réussie${r.application_id ? ` (application ${r.application_id})` : ""}. Connectez ensuite votre boutique dans Marketing social → Connecteurs.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Échec du test Etsy" };
  }
}

// ---------------------------------------------------------------------------
// Catégories Etsy (seller taxonomy)
// ---------------------------------------------------------------------------

export interface TaxonomyNode { id: number; name: string; path: string }
interface RawNode { id: number; name: string; children?: RawNode[] }

let taxonomyCache: { at: number; nodes: TaxonomyNode[] } | null = null;

export function flattenTaxonomy(nodes: RawNode[], prefix = ""): TaxonomyNode[] {
  const out: TaxonomyNode[] = [];
  for (const n of nodes) {
    const path = prefix ? `${prefix} › ${n.name}` : n.name;
    out.push({ id: n.id, name: n.name, path });
    if (n.children?.length) out.push(...flattenTaxonomy(n.children, path));
  }
  return out;
}

export async function searchEtsyTaxonomy(query: string, limit = 30): Promise<TaxonomyNode[]> {
  if (!taxonomyCache || Date.now() - taxonomyCache.at > 24 * 3600_000) {
    const r = await etsyRequest<{ results: RawNode[] }>({ path: "/seller-taxonomy/nodes" });
    taxonomyCache = { at: Date.now(), nodes: flattenTaxonomy(r.results ?? []) };
  }
  const q = query.trim().toLowerCase();
  if (!q) return taxonomyCache.nodes.slice(0, limit);
  const words = q.split(/\s+/);
  return taxonomyCache.nodes.filter((n) => words.every((w) => n.path.toLowerCase().includes(w))).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Compte Etsy d'un produit
// ---------------------------------------------------------------------------

export async function findEtsyAccountForSite(siteId: string | null, preferredId?: string | null, db: PrismaClient = defaultPrisma): Promise<SocialAccount | null> {
  const where = { provider: "ETSY" as const, kind: "SHOP" as const, isActive: true };
  if (preferredId) {
    const acc = await db.socialAccount.findFirst({ where: { ...where, id: preferredId } });
    if (acc) return acc;
  }
  const all = await db.socialAccount.findMany({ where, orderBy: { createdAt: "asc" } });
  return all.find((a) => siteId && a.siteIds.includes(siteId)) ?? all.find((a) => a.siteIds.length === 0) ?? null;
}

// ---------------------------------------------------------------------------
// Fiche produit → données Etsy
// ---------------------------------------------------------------------------

const IMAGE_ROLE_ORDER = ["MAIN", "GALLERY", "MOCKUP", "PDF_PREVIEW", "ILLUSTRATION"] as const;

export const etsyProductInclude = {
  images: { orderBy: { position: "asc" } },
  files: { orderBy: { position: "asc" } },
  category: { select: { slug: true, name: true } },
  site: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

export type EtsyProduct = Prisma.ProductGetPayload<{ include: typeof etsyProductInclude }>;

export function toEtsySource(p: EtsyProduct): EtsySourceProduct {
  return {
    name: p.name, tagline: p.tagline, shortDescription: p.shortDescription, longDescription: p.longDescription, story: p.story,
    kitContents: Array.isArray(p.kitContents) ? (p.kitContents as unknown as EtsyKitItem[]) : [],
    ageMin: p.ageMin, ageMax: p.ageMax, playersMin: p.playersMin, playersMax: p.playersMax, durationMinutes: p.durationMinutes,
    pageCount: p.pageCount, fileFormat: p.fileFormat, materials: p.materials, keywords: p.keywords, tags: p.tags, universe: p.universe,
    categoryName: p.category?.name ?? null, categorySlug: p.category?.slug ?? null, template: p.template, priceCents: p.priceCents,
    siteName: p.site?.name ?? null,
  };
}

/** Images à envoyer (≤ 10) : principale, galerie, mises en situation, aperçus, illustrations. */
export function etsyImageSources(p: Pick<EtsyProduct, "images">): Array<{ source: string; storageKey: string | null; url: string }> {
  const sorted = [...p.images]
    .filter((i) => (IMAGE_ROLE_ORDER as readonly string[]).includes(i.role))
    .sort((a, b) => IMAGE_ROLE_ORDER.indexOf(a.role as (typeof IMAGE_ROLE_ORDER)[number]) - IMAGE_ROLE_ORDER.indexOf(b.role as (typeof IMAGE_ROLE_ORDER)[number]) || a.position - b.position);
  const seen = new Set<string>();
  const out: Array<{ source: string; storageKey: string | null; url: string }> = [];
  for (const i of sorted) {
    const source = i.storageKey ?? i.url;
    if (seen.has(source)) continue;
    seen.add(source);
    out.push({ source, storageKey: i.storageKey, url: i.url });
    if (out.length >= ETSY_MAX_IMAGES) break;
  }
  return out;
}

/** Fichiers livrés (≤ 5, ≤ 20 Mo chacun) : PDF principal en premier. */
export function etsyFileSources(p: Pick<EtsyProduct, "files">): Array<{ id: string; name: string; storageKey: string; sizeBytes: number; mime: string }> {
  const order = ["MAIN_PDF", "EXTRA_PDF", "INSTRUCTIONS", "BONUS"];
  const files = [...p.files].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.position - b.position);
  if (files.length > ETSY_MAX_FILES) throw new EtsyError(`Etsy accepte 5 fichiers au maximum par fiche (ce produit en a ${files.length}) : regroupez-les (ZIP) ou retirez des compléments.`, 422, "too_many_files");
  const tooBig = files.find((f) => f.sizeBytes > ETSY_MAX_FILE_BYTES);
  if (tooBig) throw new EtsyError(`Le fichier « ${tooBig.name} » dépasse 20 Mo (limite Etsy) : compressez le PDF avant de publier sur Etsy.`, 422, "file_too_large");
  return files.map((f) => ({ id: f.id, name: f.name, storageKey: f.storageKey, sizeBytes: f.sizeBytes, mime: f.mime }));
}

async function readImageForEtsy(img: { storageKey: string | null; url: string }): Promise<{ data: Buffer; name: string; type: string }> {
  let body: Buffer | null = null;
  if (img.storageKey) body = (await getStorage().get(img.storageKey))?.body ?? null;
  if (!body) {
    const abs = img.url.startsWith("http") ? img.url : `${env.appUrl}${img.url.startsWith("/") ? "" : "/"}${img.url}`;
    const res = await fetch(abs, { cache: "no-store" });
    if (!res.ok) throw new EtsyError(`Image introuvable (${res.status}) : ${img.url}`);
    body = Buffer.from(await res.arrayBuffer());
  }
  // Etsy accepte JPG, PNG et GIF : conversion en JPEG haute qualité (WebP, AVIF…)
  const sharp = (await import("sharp")).default;
  const data = await sharp(body).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return { data, name: "image.jpg", type: "image/jpeg" };
}

async function readFileForEtsy(f: { storageKey: string; name: string; mime: string }): Promise<{ data: Buffer; name: string; type: string }> {
  const got = await getStorage().get(f.storageKey);
  if (!got) throw new EtsyError(`Fichier introuvable dans le stockage : ${f.name}`, 404, "file_missing");
  if (got.body.length > ETSY_MAX_FILE_BYTES) throw new EtsyError(`Le fichier « ${f.name} » dépasse 20 Mo (limite Etsy).`, 422, "file_too_large");
  const name = f.name.toLowerCase().endsWith(".pdf") || f.mime !== "application/pdf" ? f.name : `${f.name}.pdf`;
  return { data: got.body, name: name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 70), type: f.mime || "application/pdf" };
}

/** Lecture des binaires (remplaçable en test). */
export const etsyMedia = { readImage: readImageForEtsy, readFile: readFileForEtsy };

// ---------------------------------------------------------------------------
// Aperçu (admin produit)
// ---------------------------------------------------------------------------

export interface EtsyProductPreview {
  settings: EtsySettings;
  account: SocialAccount | null;
  listing: EtsyListing | null;
  generated: EtsyListingDraft;
  overrides: EtsyOverrides | null;
  issues: string[];
}

/** Fiche Etsy générée (sans surcharges) + surcharges enregistrées + points bloquants. */
export async function etsyProductPreview(productId: string, db: PrismaClient = defaultPrisma): Promise<EtsyProductPreview> {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId }, include: etsyProductInclude });
  const settings = await etsySettingsFor(product.siteId);
  const account = await findEtsyAccountForSite(product.siteId, settings.accountId, db);
  const listing = account ? await db.etsyListing.findUnique({ where: { productId_accountId: { productId, accountId: account.id } } }) : null;
  const generated = buildEtsyListing(toEtsySource(product), settings, null);
  const issues: string[] = [];
  try { if (!etsyFileSources(product).length) issues.push("Aucun fichier PDF : ajoutez le PDF à livrer."); } catch (e) { issues.push((e as Error).message); }
  if (!etsyImageSources(product).length) issues.push("Aucune image : Etsy exige au moins une photo.");
  if (!generated.taxonomyId) issues.push("Catégorie Etsy non définie pour la catégorie de ce produit (Marketing social → Etsy → Catégories Etsy).");
  return { settings, account, listing, generated, overrides: (listing?.overrides as EtsyOverrides | null) ?? null, issues };
}

// ---------------------------------------------------------------------------
// Publication
// ---------------------------------------------------------------------------

interface RemoteMedia { id: string; source: string }
interface EtsyListingResponse { listing_id: number; state?: string; url?: string; price?: { amount: number; divisor: number; currency_code: string } }

export interface PublishEtsyOptions { state?: "draft" | "active"; accountId?: string | null; actor?: string | null }
export interface PublishEtsyResult { listing: EtsyListing; warnings: string[]; created: boolean }

export async function etsySettingsFor(siteId: string | null): Promise<EtsySettings> {
  return getSetting("etsy", siteId);
}

function listingPayload(d: EtsyListingDraft, forCreate: boolean): Record<string, unknown> {
  if (!d.taxonomyId) throw new EtsyError("Catégorie Etsy manquante : choisissez une catégorie Etsy (taxonomy) pour cette catégorie de la boutique dans Réglages Etsy.", 422, "taxonomy_missing");
  const base: Record<string, unknown> = {
    title: d.title, description: d.description, tags: d.tags, taxonomy_id: d.taxonomyId,
    who_made: d.whoMade, when_made: d.whenMade, is_supply: false, should_auto_renew: d.autoRenew, type: "download",
  };
  if (forCreate) Object.assign(base, { quantity: ETSY_QUANTITY, price: d.priceCents / 100 });
  return base;
}

/**
 * Publie (ou met à jour) un produit sur Etsy, de façon idempotente : la fiche
 * est créée une seule fois, puis mise à jour ; images et fichiers ne sont
 * renvoyés que s'ils ont changé.
 */
export async function publishProductToEtsy(productId: string, opts: PublishEtsyOptions = {}, db: PrismaClient = defaultPrisma): Promise<PublishEtsyResult> {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId }, include: etsyProductInclude });
  const settings = await etsySettingsFor(product.siteId);
  const account = await findEtsyAccountForSite(product.siteId, opts.accountId ?? settings.accountId, db);
  if (!account) throw new EtsyNotConnectedError();
  const warnings: string[] = [];

  // Contrôles avant tout appel (fichiers : 5 max, 20 Mo max)
  const files = etsyFileSources(product);
  if (!files.length) throw new EtsyError("Aucun fichier PDF sur ce produit : ajoutez le PDF avant de publier sur Etsy.", 422, "no_file");
  const images = etsyImageSources(product);
  if (!images.length) throw new EtsyError("Aucune image sur ce produit : Etsy exige au moins une photo.", 422, "no_image");

  let row = await db.etsyListing.upsert({
    where: { productId_accountId: { productId, accountId: account.id } },
    create: { productId, accountId: account.id, currency: product.currency },
    update: {},
  });
  const draft = buildEtsyListing(toEtsySource(product), settings, (row.overrides as EtsyOverrides | null) ?? null);
  const token = await etsyAccessToken(account, db);
  const shopId = account.externalId;
  let created = false;

  try {
    let listingId = row.etsyListingId;
    if (!listingId) {
      const res = await etsyRequest<EtsyListingResponse>({ method: "POST", path: `/shops/${shopId}/listings`, token, json: listingPayload(draft, true) });
      listingId = String(res.listing_id);
      created = true;
      row = await db.etsyListing.update({ where: { id: row.id }, data: { etsyListingId: listingId, state: res.state ?? "draft", url: res.url ?? null, priceCents: draft.priceCents, lastError: null } });
    } else {
      await etsyRequest({ method: "PATCH", path: `/shops/${shopId}/listings/${listingId}`, token, json: listingPayload(draft, false) });
      if (row.priceCents !== draft.priceCents) {
        await etsyRequest({
          method: "PUT", path: `/listings/${listingId}/inventory`, token,
          json: { products: [{ sku: "", property_values: [], offerings: [{ price: draft.priceCents / 100, quantity: ETSY_QUANTITY, is_enabled: true }] }] },
        });
      }
    }

    // Images (remplacées seulement si la liste a changé)
    const imgHash = sourcesHash(images.map((i) => i.source));
    if (created || row.imagesHash !== imgHash) {
      const previous = (row.remoteImages as RemoteMedia[] | null) ?? [];
      for (const old of previous) {
        await etsyRequest({ method: "DELETE", path: `/shops/${shopId}/listings/${listingId}/images/${old.id}`, token }).catch((e) => warnings.push(`Ancienne image non supprimée : ${(e as Error).message}`));
      }
      const uploaded: RemoteMedia[] = [];
      for (const [i, img] of images.entries()) {
        try {
          const media = await etsyMedia.readImage(img);
          const form = new FormData();
          form.set("image", new Blob([new Uint8Array(media.data)], { type: media.type }), media.name);
          form.set("rank", String(i + 1));
          const r = await etsyRequest<{ listing_image_id: number }>({ method: "POST", path: `/shops/${shopId}/listings/${listingId}/images`, token, form });
          uploaded.push({ id: String(r.listing_image_id), source: img.source });
        } catch (e) {
          warnings.push(`Image ${i + 1} non envoyée : ${(e as Error).message}`);
        }
      }
      row = await db.etsyListing.update({ where: { id: row.id }, data: { remoteImages: uploaded as unknown as Prisma.InputJsonValue, imagesHash: uploaded.length === images.length ? imgHash : null } });
      if (!uploaded.length) throw new EtsyError("Aucune image n'a pu être envoyée à Etsy.", 502, "images_failed");
    }

    // Fichiers numériques (remplacés seulement s'ils ont changé)
    const fileHash = sourcesHash(files.map((f) => `${f.storageKey}#${f.sizeBytes}`));
    if (created || row.filesHash !== fileHash) {
      const previous = (row.remoteFiles as RemoteMedia[] | null) ?? [];
      for (const old of previous) {
        await etsyRequest({ method: "DELETE", path: `/shops/${shopId}/listings/${listingId}/files/${old.id}`, token }).catch((e) => warnings.push(`Ancien fichier non supprimé : ${(e as Error).message}`));
      }
      const uploaded: RemoteMedia[] = [];
      for (const [i, f] of files.entries()) {
        const media = await etsyMedia.readFile(f);
        const form = new FormData();
        form.set("file", new Blob([new Uint8Array(media.data)], { type: media.type }), media.name);
        form.set("name", media.name);
        form.set("rank", String(i + 1));
        const r = await etsyRequest<{ listing_file_id: number }>({ method: "POST", path: `/shops/${shopId}/listings/${listingId}/files`, token, form });
        uploaded.push({ id: String(r.listing_file_id), source: `${f.storageKey}#${f.sizeBytes}` });
      }
      row = await db.etsyListing.update({ where: { id: row.id }, data: { remoteFiles: uploaded as unknown as Prisma.InputJsonValue, filesHash: fileHash } });
    }

    // État : une fiche active ne redevient pas brouillon (Etsy ne le permet pas)
    const wanted = opts.state ?? settings.defaultState;
    if (wanted === "active" && row.state !== "active") {
      await etsyRequest({ method: "PATCH", path: `/shops/${shopId}/listings/${listingId}`, token, json: { state: "active" } });
    } else if (wanted === "draft" && row.state === "active") {
      warnings.push("La fiche est déjà active sur Etsy : elle reste active (Etsy ne permet pas de la repasser en brouillon ; désactivez-la si besoin).");
    }

    const fresh = await etsyRequest<EtsyListingResponse>({ path: `/listings/${listingId}`, token }).catch(() => null);
    row = await db.etsyListing.update({
      where: { id: row.id },
      data: {
        state: fresh?.state ?? (wanted === "active" ? "active" : row.state === "pending" ? "draft" : row.state),
        url: fresh?.url ?? row.url ?? `https://www.etsy.com/listing/${listingId}`,
        priceCents: fresh?.price ? etsyMoneyToCents(fresh.price) : draft.priceCents,
        currency: fresh?.price?.currency_code ?? row.currency,
        lastSyncedAt: new Date(), lastError: warnings.length ? warnings.join(" · ").slice(0, 1000) : null,
      },
    });
    return { listing: row, warnings, created };
  } catch (e) {
    await db.etsyListing.update({ where: { id: row.id }, data: { lastError: (e as Error).message.slice(0, 1000) } }).catch(() => undefined);
    throw e;
  }
}

/** Désactive une fiche Etsy (elle reste récupérable dans Etsy). */
export async function deactivateEtsyListing(listingRowId: string, db: PrismaClient = defaultPrisma): Promise<EtsyListing> {
  const row = await db.etsyListing.findUniqueOrThrow({ where: { id: listingRowId }, include: { account: true } });
  if (!row.etsyListingId) return db.etsyListing.update({ where: { id: row.id }, data: { state: "pending" } });
  const token = await etsyAccessToken(row.account, db);
  await etsyRequest({ method: "PATCH", path: `/shops/${row.account.externalId}/listings/${row.etsyListingId}`, token, json: { state: "inactive" } });
  return db.etsyListing.update({ where: { id: row.id }, data: { state: "inactive", lastSyncedAt: new Date(), lastError: null } });
}

/** Met à jour l'état et l'URL des fiches depuis Etsy. */
export async function syncEtsyListings(db: PrismaClient = defaultPrisma): Promise<{ synced: number; errors: number }> {
  const rows = await db.etsyListing.findMany({ where: { etsyListingId: { not: null }, account: { isActive: true, needsReconnect: false } }, include: { account: true } });
  let synced = 0, errors = 0;
  for (const row of rows) {
    try {
      const token = await etsyAccessToken(row.account, db);
      const l = await etsyRequest<EtsyListingResponse>({ path: `/listings/${row.etsyListingId}`, token });
      await db.etsyListing.update({ where: { id: row.id }, data: { state: l.state ?? row.state, url: l.url ?? row.url, priceCents: l.price ? etsyMoneyToCents(l.price) : row.priceCents, lastSyncedAt: new Date() } });
      synced++;
    } catch (e) {
      errors++;
      const removed = e instanceof EtsyError && e.status === 404;
      await db.etsyListing.update({ where: { id: row.id }, data: removed ? { state: "removed", lastSyncedAt: new Date() } : { lastError: (e as Error).message.slice(0, 500) } }).catch(() => undefined);
    }
  }
  return { synced, errors };
}

// ---------------------------------------------------------------------------
// Ventes Etsy → rentabilité
// ---------------------------------------------------------------------------

interface EtsyTransaction { transaction_id: number; listing_id: number | null; quantity: number; price: { amount: number; divisor: number; currency_code: string } }
interface EtsyReceipt { receipt_id: number; created_timestamp?: number; create_timestamp?: number; is_paid?: boolean; transactions?: EtsyTransaction[] }

/** Lignes de vente issues d'un reçu Etsy (fonction pure, testée). */
export function salesFromReceipt(receipt: EtsyReceipt): Array<{ externalId: string; receiptId: string; etsyListingId: string | null; quantity: number; grossCents: number; currency: string; soldAt: Date; raw: EtsyTransaction }> {
  if (receipt.is_paid === false) return [];
  const ts = receipt.created_timestamp ?? receipt.create_timestamp ?? Math.floor(Date.now() / 1000);
  return (receipt.transactions ?? []).map((t) => ({
    externalId: `${receipt.receipt_id}:${t.transaction_id}`,
    receiptId: String(receipt.receipt_id),
    etsyListingId: t.listing_id != null ? String(t.listing_id) : null,
    quantity: t.quantity || 1,
    grossCents: etsyMoneyToCents(t.price) * (t.quantity || 1),
    currency: t.price?.currency_code ?? "EUR",
    soldAt: new Date(ts * 1000),
    raw: t,
  }));
}

/** Importe les ventes depuis la dernière synchronisation (sans doublon : identifiant reçu:transaction). */
export async function importEtsySales(db: PrismaClient = defaultPrisma, opts: { accountId?: string; sinceDays?: number } = {}): Promise<{ imported: number; accounts: number }> {
  const accounts = await db.socialAccount.findMany({ where: { provider: "ETSY", kind: "SHOP", isActive: true, needsReconnect: false, ...(opts.accountId ? { id: opts.accountId } : {}) } });
  let imported = 0;
  for (const account of accounts) {
    const last = await db.externalSale.findFirst({ where: { accountId: account.id }, orderBy: { soldAt: "desc" }, select: { soldAt: true } });
    const since = last ? new Date(last.soldAt.getTime() - 2 * 86400_000) : new Date(Date.now() - (opts.sinceDays ?? 90) * 86400_000);
    const token = await etsyAccessToken(account, db);
    const listings = await db.etsyListing.findMany({ where: { accountId: account.id, etsyListingId: { not: null } }, select: { id: true, etsyListingId: true, productId: true, product: { select: { siteId: true } } } });
    const byEtsyId = new Map(listings.map((l) => [l.etsyListingId!, l]));
    const settingsCache = new Map<string, EtsySettings>();
    for (let offset = 0; offset < 5000; offset += 100) {
      const page = await etsyRequest<{ count: number; results: EtsyReceipt[] }>({ path: `/shops/${account.externalId}/receipts`, token, query: { min_created: Math.floor(since.getTime() / 1000), limit: 100, offset, was_paid: "true" } });
      for (const receipt of page.results ?? []) {
        for (const sale of salesFromReceipt(receipt)) {
          const link = sale.etsyListingId ? byEtsyId.get(sale.etsyListingId) : undefined;
          const siteId = link?.product.siteId ?? null;
          const key = siteId ?? "_";
          if (!settingsCache.has(key)) settingsCache.set(key, await etsySettingsFor(siteId));
          const fees = estimateEtsyFeesCents(sale.grossCents, settingsCache.get(key)!, sale.quantity);
          const res = await db.externalSale.createMany({
            data: [{
              channel: "ETSY", externalId: sale.externalId, accountId: account.id, productId: link?.productId ?? null, siteId, listingId: link?.id ?? null,
              etsyListingId: sale.etsyListingId, receiptId: sale.receiptId, quantity: sale.quantity, grossCents: sale.grossCents, feesCents: fees,
              netCents: sale.grossCents - fees, currency: sale.currency, soldAt: sale.soldAt, raw: sale.raw as unknown as Prisma.InputJsonValue,
            }],
            skipDuplicates: true,
          });
          imported += res.count;
        }
      }
      if (!page.results?.length || offset + 100 >= (page.count ?? 0)) break;
    }
  }
  return { imported, accounts: accounts.length };
}

/** Tâche quotidienne (cron marketing) : synchronisation des fiches puis import des ventes. */
export async function runEtsyJobs(db: PrismaClient = defaultPrisma, now = new Date()): Promise<{ refreshed: number; synced: number; imported: number; errors: string[] }> {
  const errors: string[] = [];
  if (!(await isEtsyConfigured())) return { refreshed: 0, synced: 0, imported: 0, errors };
  // Le jeton de rafraîchissement (≈ 90 jours) est renouvelé à chaque rafraîchissement : on le fait vivre chaque jour
  let refreshed = 0;
  const accounts = await db.socialAccount.findMany({ where: { provider: "ETSY", isActive: true, needsReconnect: false } });
  for (const a of accounts) {
    try { await etsyAccessToken(a, db, now, true); refreshed++; } catch (e) { errors.push(`jeton ${a.name} : ${(e as Error).message}`); }
  }
  let synced = 0, imported = 0;
  try { synced = (await syncEtsyListings(db)).synced; } catch (e) { errors.push(`synchro fiches : ${(e as Error).message}`); }
  try { imported = (await importEtsySales(db)).imported; } catch (e) { errors.push(`import ventes : ${(e as Error).message}`); }
  return { refreshed, synced, imported, errors };
}
