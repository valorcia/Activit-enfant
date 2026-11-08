import { SocialApiError, isoDate, toCents, type DiscoveredAccount, type ExternalCampaign, type SocialConnector, type SpendRow } from "./types";

/**
 * Connecteur TikTok : Login Kit v2 (OAuth), Content Posting API (photos) et
 * Marketing API (dépenses). Scopes : user.info.basic, video.publish, video.upload.
 * La Content Posting API exige un audit d'application avant de publier en public
 * (sinon les publications sont privées « SELF_ONLY »).
 */
const AUTH = "https://www.tiktok.com/v2/auth/authorize/";
const OPEN = "https://open.tiktokapis.com/v2";
const BUSINESS = "https://business-api.tiktok.com/open_api/v1.3";
const SCOPES = ["user.info.basic", "user.info.profile", "video.publish", "video.upload"];

function clientKey() { return process.env.TIKTOK_CLIENT_KEY ?? ""; }
function clientSecret() { return process.env.TIKTOK_CLIENT_SECRET ?? ""; }

async function post<T>(url: string, body: unknown, token?: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json; charset=UTF-8", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body), cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string }; code?: number; message?: string } & T;
  const code = json.error?.code ?? (json.code !== undefined && json.code !== 0 ? String(json.code) : undefined);
  if (!res.ok || (code && code !== "ok")) {
    const msg = json.error?.message ?? json.message ?? res.statusText;
    const reconnect = res.status === 401 || code === "access_token_invalid" || code === "40102";
    throw new SocialApiError(`TikTok : ${msg}`, res.status, code, reconnect);
  }
  return json;
}

export const tiktokConnector: SocialConnector = {
  provider: "TIKTOK",
  isConfigured: () => Boolean(clientKey() && clientSecret()),

  authorizeUrl(state, redirectUri) {
    const u = new URL(AUTH);
    u.searchParams.set("client_key", clientKey());
    u.searchParams.set("scope", SCOPES.join(","));
    u.searchParams.set("response_type", "code");
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    return u.toString();
  },

  async exchangeCode(code, redirectUri) {
    const res = await fetch(`${OPEN}/oauth/token/`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: clientKey(), client_secret: clientSecret(), code, grant_type: "authorization_code", redirect_uri: redirectUri }),
      cache: "no-store",
    });
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
    if (!res.ok || !json.access_token) throw new SocialApiError(`TikTok : ${json.error_description ?? json.error ?? "échange de code refusé"}`, res.status, json.error);
    return { accessToken: json.access_token, refreshToken: json.refresh_token ?? null, expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null, scopes: json.scope?.split(",") ?? SCOPES };
  },

  async listAccounts(userToken) {
    const res = await fetch(`${OPEN}/user/info/?fields=open_id,union_id,avatar_url,display_name,username`, { headers: { authorization: `Bearer ${userToken}` }, cache: "no-store" });
    const json = (await res.json()) as { data?: { user?: { open_id: string; display_name?: string; username?: string; avatar_url?: string } }; error?: { code?: string; message?: string } };
    if (!res.ok || !json.data?.user) throw new SocialApiError(`TikTok : ${json.error?.message ?? "profil inaccessible"}`, res.status, json.error?.code, res.status === 401);
    const u = json.data.user;
    const out: DiscoveredAccount[] = [{ kind: "TIKTOK", externalId: u.open_id, name: u.display_name ?? u.username ?? "TikTok", username: u.username ?? null, avatarUrl: u.avatar_url ?? null, accessToken: userToken, scopes: SCOPES }];
    // Comptes publicitaires (Marketing API) : nécessite un jeton TikTok for Business distinct (TIKTOK_ADS_ACCESS_TOKEN + TIKTOK_ADVERTISER_IDS)
    const adsToken = process.env.TIKTOK_ADS_ACCESS_TOKEN;
    const advertisers = (process.env.TIKTOK_ADVERTISER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const id of advertisers) {
      if (adsToken) out.push({ kind: "AD_ACCOUNT", externalId: id, name: `Compte publicitaire TikTok ${id}`, accessToken: adsToken, metadata: { source: "env" } });
    }
    return out;
  },

  async publishPhotoPost(account, input) {
    if (account.kind !== "TIKTOK") throw new SocialApiError("Seul un compte TikTok peut publier");
    if (!input.imageUrls.length) throw new SocialApiError("TikTok exige au moins une image");
    const r = await post<{ data?: { publish_id?: string } }>(`${OPEN}/post/publish/content/init/`, {
      post_info: { title: input.text.slice(0, 90), description: input.text.slice(0, 4000), privacy_level: "PUBLIC_TO_EVERYONE", disable_comment: false, auto_add_music: true },
      source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: input.imageUrls.slice(0, 35) },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    }, account.token);
    const id = r.data?.publish_id;
    if (!id) throw new SocialApiError("TikTok : identifiant de publication manquant");
    return { externalPostId: id, externalUrl: account.username ? `https://www.tiktok.com/@${account.username}` : null };
  },

  async listCampaigns(adAccount) {
    const u = new URL(`${BUSINESS}/campaign/get/`);
    u.searchParams.set("advertiser_id", adAccount.externalId);
    u.searchParams.set("page_size", "100");
    const res = await fetch(u, { headers: { "Access-Token": adAccount.token }, cache: "no-store" });
    const json = (await res.json()) as { code?: number; message?: string; data?: { list?: Array<{ campaign_id: string; campaign_name: string; operation_status?: string }> } };
    if (json.code !== 0) throw new SocialApiError(`TikTok Ads : ${json.message ?? "erreur"}`, res.status, String(json.code), json.code === 40105);
    return (json.data?.list ?? []).map((c): ExternalCampaign => ({ id: c.campaign_id, name: c.campaign_name, status: c.operation_status }));
  },

  async getCampaignSpend(adAccount, externalCampaignId, since, until) {
    const json = await post<{ data?: { list?: Array<{ dimensions: { stat_time_day: string }; metrics: { spend?: string; impressions?: string; clicks?: string } }> } }>(
      `${BUSINESS}/report/integrated/get/`,
      { advertiser_id: adAccount.externalId, report_type: "BASIC", data_level: "AUCTION_CAMPAIGN", dimensions: ["campaign_id", "stat_time_day"], metrics: ["spend", "impressions", "clicks"], start_date: isoDate(since), end_date: isoDate(until), filtering: [{ field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify([externalCampaignId]) }], page_size: 1000 },
      undefined,
      { "Access-Token": adAccount.token },
    );
    return (json.data?.list ?? []).map((row): SpendRow => ({ date: row.dimensions.stat_time_day.slice(0, 10), spendCents: toCents(row.metrics.spend), impressions: Number(row.metrics.impressions ?? 0), clicks: Number(row.metrics.clicks ?? 0), raw: row }));
  },
};
