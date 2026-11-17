import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { DEFAULT_SITE_SLUG, PREVIEW_COOKIE, SITE_HEADER, SITE_ROUTE_PREFIX } from "@/lib/sites/constants";
import { isStaticFilePath, resolveSiteSlug, type SiteRouting } from "@/lib/sites/host";
import { CREATOR_SESSION_COOKIE, isPublicCreatorPath, verifySessionToken } from "@/lib/creators/tokens";
import { LOCALE_COOKIE, REF_COOKIE, REF_COOKIE_DAYS, sanitizeRef, UNWRITTEN_STOREFRONT } from "@/lib/unwritten/constants";
import { routeUnwritten } from "@/lib/unwritten/proxy-route";

/**
 * Proxy (Next 16) :
 *  1. Multi-univers : résout l'univers à partir du nom d'hôte (domaine exact, sous-domaine
 *     du domaine hub, cookie de prévisualisation `?site=slug`, sinon univers par défaut),
 *     pose l'en-tête x-site-slug et réécrit les routes publiques vers /s/<slug>/….
 *  2. Protection des routes d'administration : /admin/* (hors connexion) et /api/admin/*
 *     exigent une session valide ; les rôles sont vérifiés dans les pages et actions.
 *  3. Espace créatrices : /espace-createur/* (hors connexion) et /api/createur/* exigent le
 *     cookie de session créatrice signé (distinct de l'admin) ; la base est vérifiée dans les pages.
 *     Ces routes sont communes à tous les univers : pas de réécriture.
 *  4. Marques à vitrine UNWRITTEN (`Site.storefront = "unwritten"`) : URLs localisées `/{en|fr}/…`
 *     réécrites vers `/u/<locale>/…` (src/app/u), langue négociée (cookie, Accept-Language), paramètre
 *     `ref` conservé dans un cookie jusqu'au paiement. Les autres univers ne sont pas concernés.
 */

let routingCache: { at: number; sites: SiteRouting[] } | null = null;

async function getRouting(): Promise<SiteRouting[]> {
  if (routingCache && Date.now() - routingCache.at < 60_000) return routingCache.sites;
  try {
    const rows = await prisma.site.findMany({ select: { slug: true, status: true, domains: true, isDefault: true, storefront: true, locales: true, defaultLocale: true } });
    routingCache = { at: Date.now(), sites: rows };
  } catch (e) {
    console.error("[proxy] univers indisponibles", e instanceof Error ? e.message : e);
    if (!routingCache) return [];
  }
  return routingCache!.sites;
}

function withSiteHeader(req: NextRequest, slug: string): Headers {
  const h = new Headers(req.headers);
  h.set(SITE_HEADER, slug);
  return h;
}

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Accès direct aux routes internes réécrites : interdit
  // (/u/… n'a pas besoin d'être bloqué : toute page publique est réécrite, /u/… n'est donc jamais servi tel quel)
  if (pathname === SITE_ROUTE_PREFIX || pathname.startsWith(`${SITE_ROUTE_PREFIX}/`)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const sites = await getRouting();
  const previewParam = searchParams.get("site");
  const previewCookie = req.cookies.get(PREVIEW_COOKIE)?.value ?? null;
  const previewSlug = previewParam && previewParam !== "default" ? previewParam : previewParam === "default" ? null : previewCookie;
  const slug = resolveSiteSlug(sites, { host: req.headers.get("x-forwarded-host") ?? req.headers.get("host"), hubDomain: process.env.HUB_DOMAIN, previewSlug }, DEFAULT_SITE_SLUG);
  const headers = withSiteHeader(req, slug);

  // Administration : protection par session
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!pathname.startsWith("/admin/connexion")) {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET,
        // Nom du cookie (__Secure- ou non) déduit du protocole réel de la requête (https derrière Vercel, http en local)
        secureCookie: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
      });
      if (!token) {
        if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
        const url = new URL("/admin/connexion", req.url);
        url.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next({ request: { headers } });
  }

  // Espace créatrices : session signée requise (sauf page de connexion par lien magique)
  if (pathname === "/espace-createur" || pathname.startsWith("/espace-createur/") || pathname.startsWith("/api/createur/")) {
    if (!isPublicCreatorPath(pathname) && !verifySessionToken(req.cookies.get(CREATOR_SESSION_COOKIE)?.value)) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Session créatrice requise" }, { status: 401 });
      return NextResponse.redirect(new URL("/espace-createur/connexion", req.url));
    }
    return NextResponse.next({ request: { headers } });
  }

  // API, fichiers (sitemap.xml, robots.txt, manifest…) : pas de réécriture, univers transmis par en-tête.
  // Seules les extensions de fichiers connues comptent : un jeton signé (`/commande/<b64>.<exp>.<sig>`)
  // contient des points et doit rester une page réécrite.
  if (pathname.startsWith("/api/") || isStaticFilePath(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  // Pages publiques : réécriture vers /s/<slug>/… (ou /u/<locale>/… pour une vitrine UNWRITTEN)
  const routing = sites.find((s) => s.slug === slug);
  let res: NextResponse;
  if (routing?.storefront === UNWRITTEN_STOREFRONT) {
    const decision = routeUnwritten({
      pathname,
      search: req.nextUrl.search,
      locales: routing.locales ?? [],
      defaultLocale: routing.defaultLocale ?? "en",
      cookieLocale: req.cookies.get(LOCALE_COOKIE)?.value,
      acceptLanguage: req.headers.get("accept-language"),
    });
    if (decision.type === "redirect") {
      res = NextResponse.redirect(new URL(decision.location, req.url), 307);
      res.headers.set("vary", "accept-language, cookie");
    } else {
      const url = req.nextUrl.clone();
      url.pathname = decision.pathname;
      res = NextResponse.rewrite(url, { request: { headers } });
      res.headers.set("content-language", decision.locale);
      // Sélecteur de langue mémorisé : la dernière langue visitée devient la préférence
      if (decision.rememberLocale) res.cookies.set(LOCALE_COOKIE, decision.locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    }
    // Attribution (volet viral) : `ref` conservé 30 jours (dernier clic) puis copié sur le brouillon et la commande
    const ref = sanitizeRef(searchParams.get("ref"));
    if (ref) res.cookies.set(REF_COOKIE, ref, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * REF_COOKIE_DAYS });
  } else {
    const url = req.nextUrl.clone();
    url.pathname = `${SITE_ROUTE_PREFIX}/${slug}${pathname === "/" ? "" : pathname}`;
    res = NextResponse.rewrite(url, { request: { headers } });
  }
  if (previewParam) {
    if (previewParam === "default") res.cookies.delete(PREVIEW_COOKIE);
    else if (sites.some((s) => s.slug === previewParam && s.status !== "ARCHIVED")) {
      res.cookies.set(PREVIEW_COOKIE, previewParam, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico).*)"],
};
