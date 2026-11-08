import type { SocialAccount, SocialProvider } from "@prisma/client";
// Types et utilitaires partagés par les connecteurs (sans dépendance serveur)

/**
 * Interface commune des connecteurs réseaux sociaux.
 * Les jetons sont stockés chiffrés ; `tokenOf(account)` les déchiffre à la demande.
 */
export interface DiscoveredAccount {
  kind: "PAGE" | "INSTAGRAM" | "TIKTOK" | "AD_ACCOUNT";
  externalId: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  accessToken: string; // jeton propre au compte (Page token) ou jeton utilisateur
  parentExternalId?: string | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface PublishInput {
  text: string;
  imageUrls: string[]; // URLs publiques absolues
  linkUrl?: string | null;
}

export interface PublishResult { externalPostId: string; externalUrl?: string | null }

export interface SpendRow { date: string; spendCents: number; impressions?: number; clicks?: number; raw?: unknown }

export interface ExternalCampaign { id: string; name: string; status?: string }

export interface SocialConnector {
  provider: SocialProvider;
  isConfigured(): Promise<boolean>;
  authorizeUrl(state: string, redirectUri: string): Promise<string>;
  exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string | null; expiresAt?: Date | null; scopes?: string[] }>;
  listAccounts(userAccessToken: string): Promise<DiscoveredAccount[]>;
  publishPhotoPost(account: SocialAccount & { token: string }, input: PublishInput): Promise<PublishResult>;
  listCampaigns(adAccount: SocialAccount & { token: string }): Promise<ExternalCampaign[]>;
  getCampaignSpend(adAccount: SocialAccount & { token: string }, externalCampaignId: string, since: Date, until: Date): Promise<SpendRow[]>;
}

export class SocialApiError extends Error {
  constructor(message: string, public status?: number, public code?: string, public reconnect = false) {
    super(message);
  }
}

export function toCents(amount: number | string | null | undefined): number {
  const n = typeof amount === "string" ? Number(amount) : amount ?? 0;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
