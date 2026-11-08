import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, hasInternalToken, isAuthEnabled, isValidSession } from "@/lib/auth";

/**
 * Protège toute l'interface du studio par mot de passe (STUDIO_PASSWORD).
 * Exemptions : la page de connexion, les routes internes du worker (/api/internal),
 * et les routes d'impression / d'assets lorsque le jeton interne est présent
 * (rendu PDF par Chromium côté worker), et les liens d'aperçu partagés (/preview/<jeton>,
 * images servies avec ?pt=<jeton>) : le jeton signé est vérifié par la page et la route d'asset.
 */
export async function middleware(req: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/connexion") || pathname.startsWith("/api/internal")) return NextResponse.next();
  if ((pathname.startsWith("/print") || pathname.startsWith("/api/assets")) && hasInternalToken(req)) return NextResponse.next();
  // Aperçu partagé en lecture seule : aucune action d'édition n'y est exposée
  if (pathname.startsWith("/preview/")) return NextResponse.next();
  if (pathname.startsWith("/api/assets/") && req.nextUrl.searchParams.has("pt")) return NextResponse.next();

  const ok = await isValidSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  const url = new URL("/connexion", req.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
