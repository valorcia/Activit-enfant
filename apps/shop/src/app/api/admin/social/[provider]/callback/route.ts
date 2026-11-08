import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { encryptSecret } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { getConnector } from "@/lib/social";
import { verifySignedPayload } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retour OAuth : échange du code, découverte des comptes (Pages, Instagram, comptes pub) et enregistrement chiffré. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const key = provider.toUpperCase();
  const back = (q: string) => NextResponse.redirect(`${env.appUrl}/admin/marketing/connecteurs?${q}`);
  if (key !== "META" && key !== "TIKTOK") return back("erreur=fournisseur");
  const user = await getAdminUser();
  if (!user) return back("erreur=session");
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  if (url.searchParams.get("error")) return back(`erreur=${encodeURIComponent(url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "refus")}`);
  const payload = verifySignedPayload(state);
  if (!code || payload !== `${key}:${user.id}`) return back("erreur=etat-invalide");

  try {
    const connector = getConnector(key);
    const redirectUri = `${env.appUrl}/api/admin/social/${provider.toLowerCase()}/callback`;
    const token = await connector.exchangeCode(code, redirectUri);
    const accounts = await connector.listAccounts(token.accessToken);
    const idByExternal = new Map<string, string>();
    // Parents (Pages) d'abord pour pouvoir rattacher les comptes Instagram
    const ordered = [...accounts].sort((a, b) => (a.parentExternalId ? 1 : 0) - (b.parentExternalId ? 1 : 0));
    for (const a of ordered) {
      const row = await prisma.socialAccount.upsert({
        where: { provider_kind_externalId: { provider: key, kind: a.kind, externalId: a.externalId } },
        create: {
          provider: key, kind: a.kind, externalId: a.externalId, name: a.name, username: a.username ?? null, avatarUrl: a.avatarUrl ?? null,
          accessTokenEnc: encryptSecret(a.accessToken), refreshTokenEnc: token.refreshToken ? encryptSecret(token.refreshToken) : null,
          tokenExpiresAt: token.expiresAt ?? null, scopes: a.scopes ?? token.scopes ?? [], metadata: (a.metadata ?? {}) as object,
          parentId: a.parentExternalId ? idByExternal.get(a.parentExternalId) ?? null : null, connectedById: user.id, isActive: true, needsReconnect: false,
        },
        update: {
          name: a.name, username: a.username ?? null, avatarUrl: a.avatarUrl ?? null, accessTokenEnc: encryptSecret(a.accessToken),
          refreshTokenEnc: token.refreshToken ? encryptSecret(token.refreshToken) : undefined, tokenExpiresAt: token.expiresAt ?? null,
          scopes: a.scopes ?? token.scopes ?? [], metadata: (a.metadata ?? {}) as object, parentId: a.parentExternalId ? idByExternal.get(a.parentExternalId) ?? null : undefined,
          connectedById: user.id, isActive: true, needsReconnect: false,
        },
      });
      idByExternal.set(a.externalId, row.id);
    }
    await audit({ userId: user.id, action: "social.connect", entity: "socialAccount", data: { provider: key, accounts: accounts.length } });
    return back(`connecte=${provider.toLowerCase()}&comptes=${accounts.length}`);
  } catch (e) {
    console.error("[social:callback]", e);
    return back(`erreur=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 120) : "echec")}`);
  }
}
