import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { createPkcePair, etsyAuthorizeUrl, isEtsyConfigured, ETSY_PKCE_COOKIE } from "@/lib/channels/etsy";
import { signPayload } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Démarre l'autorisation Etsy (OAuth 2.0 + PKCE) : état signé et vérificateur PKCE dans un cookie httpOnly, 10 minutes. */
export async function GET() {
  const user = await getAdminUser();
  if (!user || !roleCan(user.role, "marketing:write")) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  if (!(await isEtsyConfigured())) return NextResponse.redirect(`${env.appUrl}/admin/marketing/connecteurs?erreur=non-configure`);
  const exp = Math.floor(Date.now() / 1000) + 600;
  const state = signPayload(`ETSY:${user.id}`, exp);
  const { verifier, challenge } = createPkcePair();
  const res = NextResponse.redirect(await etsyAuthorizeUrl(state, challenge));
  res.cookies.set(ETSY_PKCE_COOKIE, signPayload(verifier, exp), {
    httpOnly: true, sameSite: "lax", secure: env.appUrl.startsWith("https://"), maxAge: 600, path: "/api/admin/social/etsy",
  });
  return res;
}
