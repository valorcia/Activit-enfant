import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { getConnector } from "@/lib/social";
import { signPayload } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Démarre l'autorisation OAuth (Meta ou TikTok) : état signé lié à l'utilisateur, valable 10 minutes. */
export async function GET(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const user = await getAdminUser();
  if (!user || !roleCan(user.role, "marketing:write")) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { provider } = await ctx.params;
  const key = provider.toUpperCase();
  if (key !== "META" && key !== "TIKTOK") return NextResponse.json({ error: "Fournisseur inconnu" }, { status: 404 });
  const connector = getConnector(key);
  if (!connector.isConfigured()) return NextResponse.redirect(`${env.appUrl}/admin/marketing/connecteurs?erreur=non-configure`);
  const state = signPayload(`${key}:${user.id}`, Math.floor(Date.now() / 1000) + 600);
  const redirectUri = `${env.appUrl}/api/admin/social/${provider.toLowerCase()}/callback`;
  return NextResponse.redirect(connector.authorizeUrl(state, redirectUri));
}
