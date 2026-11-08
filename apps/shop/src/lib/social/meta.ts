import { getSecret } from "@/lib/integrations/secrets";
import type { SocialAccount } from "@prisma/client";
import { SocialApiError, isoDate, toCents, type DiscoveredAccount, type ExternalCampaign, type PublishInput, type PublishResult, type SocialConnector, type SpendRow } from "./types";

/**
 * Connecteur Meta (Facebook Pages, Instagram professionnel, comptes publicitaires)
 * via Graph API v21. Permissions demandées (soumises à validation d'app Meta) :
 * pages_show_list, pages_manage_posts, pages_read_engagement, instagram_basic,
 * instagram_content_publish, ads_read, ads_management, business_management.
 */
const GRAPH = "https://graph.facebook.com/v21.0";
const SCOPES = ["public_profile", "pages_show_list", "pages_manage_posts", "pages_read_engagement", "instagram_basic", "instagram_content_publish", "ads_read", "ads_management", "business_management"];

// Identifiants de l'application Meta : Administration → Paramètres → Intégrations (prioritaire) ou META_APP_ID / META_APP_SECRET
const appId = () => getSecret("meta.appId");
const appSecret = () => getSecret("meta.appSecret");

async function graph<T>(path: string, params: Record<string, string | undefined>, init: { method?: "GET" | "POST"; token: string }): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) (init.method === "POST" ? body : url.searchParams).set(k, v);
  url.searchParams.set("access_token", init.token);
  const res = await fetch(url, { method: init.method ?? "GET", body: init.method === "POST" ? body : undefined, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; type?: string; error_subcode?: number } } & T;
  if (!res.ok || json.error) {
    const err = json.error ?? {};
    // 190 = jeton invalide/expiré ; 10/200 = permission manquante
    const reconnect = err.code === 190 || err.type === "OAuthException";
    throw new SocialApiError(`Meta : ${err.message ?? res.statusText}`, res.status, String(err.code ?? ""), reconnect);
  }
  return json;
}

export const metaConnector: SocialConnector = {
  provider: "META",
  isConfigured: async () => Boolean((await appId()) && (await appSecret())),

  async authorizeUrl(state, redirectUri) {
    const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    u.searchParams.set("client_id", await appId());
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    u.searchParams.set("scope", SCOPES.join(","));
    u.searchParams.set("response_type", "code");
    return u.toString();
  },

  async exchangeCode(code, redirectUri) {
    const short = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", { client_id: await appId(), client_secret: await appSecret(), redirect_uri: redirectUri, code }, { token: "" });
    // Jeton longue durée (~60 jours)
    const long = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", { grant_type: "fb_exchange_token", client_id: await appId(), client_secret: await appSecret(), fb_exchange_token: short.access_token }, { token: "" });
    const expiresAt = long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null;
    return { accessToken: long.access_token, expiresAt, scopes: SCOPES };
  },

  async listAccounts(userToken) {
    const out: DiscoveredAccount[] = [];
    const pages = await graph<{ data: Array<{ id: string; name: string; access_token: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string; username?: string; profile_picture_url?: string; name?: string } }> }>(
      "me/accounts",
      { fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url,name}", limit: "50" },
      { token: userToken },
    );
    for (const p of pages.data ?? []) {
      out.push({ kind: "PAGE", externalId: p.id, name: p.name, avatarUrl: p.picture?.data?.url ?? null, accessToken: p.access_token });
      if (p.instagram_business_account) {
        const ig = p.instagram_business_account;
        out.push({ kind: "INSTAGRAM", externalId: ig.id, name: ig.name ?? ig.username ?? "Instagram", username: ig.username ?? null, avatarUrl: ig.profile_picture_url ?? null, accessToken: p.access_token, parentExternalId: p.id });
      }
    }
    try {
      const ads = await graph<{ data: Array<{ id: string; account_id: string; name: string; currency?: string; account_status?: number }> }>("me/adaccounts", { fields: "id,account_id,name,currency,account_status", limit: "50" }, { token: userToken });
      for (const a of ads.data ?? []) {
        out.push({ kind: "AD_ACCOUNT", externalId: a.id, name: a.name || `Compte ${a.account_id}`, accessToken: userToken, metadata: { currency: a.currency, accountStatus: a.account_status } });
      }
    } catch (e) {
      // ads_read non accordé : on continue avec les Pages/Instagram seulement
      if (!(e instanceof SocialApiError)) throw e;
    }
    return out;
  },

  async publishPhotoPost(account, input) {
    const image = input.imageUrls[0];
    if (account.kind === "INSTAGRAM") {
      if (!image) throw new SocialApiError("Instagram exige une image");
      const container = await graph<{ id: string }>(`${account.externalId}/media`, { image_url: image, caption: input.text }, { method: "POST", token: account.token });
      const published = await graph<{ id: string }>(`${account.externalId}/media_publish`, { creation_id: container.id }, { method: "POST", token: account.token });
      const info = await graph<{ permalink?: string }>(`${published.id}`, { fields: "permalink" }, { token: account.token }).catch(() => ({ permalink: undefined }));
      return { externalPostId: published.id, externalUrl: info.permalink ?? null };
    }
    if (account.kind === "PAGE") {
      if (image) {
        const r = await graph<{ id: string; post_id?: string }>(`${account.externalId}/photos`, { url: image, message: input.linkUrl ? `${input.text}\n\n${input.linkUrl}` : input.text }, { method: "POST", token: account.token });
        const postId = r.post_id ?? r.id;
        return { externalPostId: postId, externalUrl: `https://www.facebook.com/${postId}` };
      }
      const r = await graph<{ id: string }>(`${account.externalId}/feed`, { message: input.text, link: input.linkUrl ?? undefined }, { method: "POST", token: account.token });
      return { externalPostId: r.id, externalUrl: `https://www.facebook.com/${r.id}` };
    }
    throw new SocialApiError("Ce type de compte ne permet pas la publication");
  },

  async listCampaigns(adAccount) {
    const r = await graph<{ data: Array<{ id: string; name: string; status?: string }> }>(`${adAccount.externalId}/campaigns`, { fields: "id,name,status", limit: "100" }, { token: adAccount.token });
    return (r.data ?? []).map((c): ExternalCampaign => ({ id: c.id, name: c.name, status: c.status }));
  },

  async getCampaignSpend(adAccount, externalCampaignId, since, until) {
    const r = await graph<{ data: Array<{ date_start: string; spend?: string; impressions?: string; clicks?: string }> }>(
      `${externalCampaignId}/insights`,
      { fields: "spend,impressions,clicks", time_increment: "1", time_range: JSON.stringify({ since: isoDate(since), until: isoDate(until) }), level: "campaign" },
      { token: adAccount.token },
    );
    return (r.data ?? []).map((row): SpendRow => ({ date: row.date_start, spendCents: toCents(row.spend), impressions: Number(row.impressions ?? 0), clicks: Number(row.clicks ?? 0), raw: row }));
  },
};

export type { SocialAccount, PublishInput, PublishResult };
