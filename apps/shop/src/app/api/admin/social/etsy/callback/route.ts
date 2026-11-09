import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { exchangeEtsyCode, fetchEtsyShop, saveEtsyAccount, ETSY_PKCE_COOKIE } from "@/lib/channels/etsy";
import { verifySignedPayload } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retour OAuth Etsy : échange du code (PKCE), lecture de la boutique, enregistrement chiffré des jetons. */
export async function GET(req: Request) {
  const back = (q: string) => {
    const res = NextResponse.redirect(`${env.appUrl}/admin/marketing/connecteurs?${q}`);
    res.cookies.set(ETSY_PKCE_COOKIE, "", { maxAge: 0, path: "/api/admin/social/etsy" });
    return res;
  };
  const user = await getAdminUser();
  if (!user) return back("erreur=session");
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(`erreur=${encodeURIComponent(url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "refus")}`);
  const code = url.searchParams.get("code");
  const state = verifySignedPayload(url.searchParams.get("state") ?? "");
  const verifier = verifySignedPayload((await cookies()).get(ETSY_PKCE_COOKIE)?.value ?? "");
  if (!code || state !== `ETSY:${user.id}` || !verifier) return back("erreur=etat-invalide");
  try {
    const tokens = await exchangeEtsyCode(code, verifier);
    const shop = await fetchEtsyShop(tokens.access_token);
    const account = await saveEtsyAccount(tokens, shop, user.id);
    await audit({ userId: user.id, action: "social.connect", entity: "socialAccount", entityId: account.id, data: { provider: "ETSY", shop: shop.name } });
    return back(`connecte=etsy&comptes=1`);
  } catch (e) {
    console.error("[etsy:callback]", e);
    return back(`erreur=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 160) : "echec")}`);
  }
}
