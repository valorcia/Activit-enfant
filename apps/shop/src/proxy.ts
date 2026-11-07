import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Protection des routes d'administration : toute route /admin/* (sauf la page de
 * connexion) et /api/admin/* exige un jeton de session valide. Les vérifications
 * de rôle fines sont faites dans les pages et actions (requirePermission).
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname.startsWith("/admin/connexion");
  if (isLogin) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // Nom du cookie (__Secure- ou non) déduit du protocole réel de la requête (https derrière Vercel, http en local)
    secureCookie: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }
    const url = new URL("/admin/connexion", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
