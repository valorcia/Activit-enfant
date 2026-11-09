import "server-only";
import type { SocialAccount, SocialProvider } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { metaConnector } from "./meta";
import { tiktokConnector } from "./tiktok";
import type { SocialConnector } from "./types";

export * from "./types";

/** Réseaux de publication. Etsy (boutique de vente) a son propre connecteur : `@/lib/channels/etsy`. */
export type PublishingProvider = Exclude<SocialProvider, "ETSY">;

export const connectors: Record<PublishingProvider, SocialConnector> = {
  META: metaConnector,
  TIKTOK: tiktokConnector,
};

export function isPublishingProvider(provider: SocialProvider): provider is PublishingProvider {
  return provider !== "ETSY";
}

export function getConnector(provider: SocialProvider): SocialConnector {
  if (!isPublishingProvider(provider)) throw new Error("Etsy n'est pas un réseau de publication : utilisez le connecteur Etsy");
  return connectors[provider];
}

export function tokenOf(account: SocialAccount): string {
  return decryptSecret(account.accessTokenEnc);
}

export function withToken(account: SocialAccount): SocialAccount & { token: string } {
  return { ...account, token: tokenOf(account) };
}
