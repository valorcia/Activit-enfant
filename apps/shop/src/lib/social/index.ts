import "server-only";
import type { SocialAccount, SocialProvider } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { metaConnector } from "./meta";
import { tiktokConnector } from "./tiktok";
import type { SocialConnector } from "./types";

export * from "./types";

export const connectors: Record<SocialProvider, SocialConnector> = {
  META: metaConnector,
  TIKTOK: tiktokConnector,
};

export function getConnector(provider: SocialProvider): SocialConnector {
  return connectors[provider];
}

export function tokenOf(account: SocialAccount): string {
  return decryptSecret(account.accessTokenEnc);
}

export function withToken(account: SocialAccount): SocialAccount & { token: string } {
  return { ...account, token: tokenOf(account) };
}
