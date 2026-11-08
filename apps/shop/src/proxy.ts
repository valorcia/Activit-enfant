import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { DEFAULT_SITE_SLUG, PREVIEW_COOKIE, SITE_HEADER, SITE_ROUTE_PREFIX } from "@/lib/sites/constants";
import { resolveSiteSlug, type SiteRouting } from "@/lib/sites/host";

/**
 * Proxy (Next 16) :
 *  1. Multi-univers : résout l'univers à partir du nom d'hôte (domaine exact, sous-domaine
 *     du domaine hub, cookie de prévisualisation `?site=slug`, sinon univers par défaut),
 *     pose l'en-tête x-site-slug et réécrit les routes publiques vers /s/<slug>/….
 *  2. Protection des routes d'administration : /admin/* (hors connexion) et /api/admin/*
 *     exigent une session valide ; les rôles sont vérifiés dans les pages et actions.
 */

let routingCache: { at: number; sites: SiteRouting[] } | null = null;

async function getRouting(): Promise<SiteRouting[]> {
  if (routingCache && Date.now() - routingCache.at < 60_000) return routingCache.sites;
  try {
    const rows = await prisma.site.findMany({ select: { slug: true, status: true, domains: true, isDefault: true } });
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

  // API, fichiers (sitemap.xml, robots.txt, manifest…) : pas de réécriture, univers transmis par en-tête
  const lastSegment = pathname.split("/").pop() ?? "";
  if (pathname.startsWith("/api/") || lastSegment.includes(".")) {
    return NextResponse.next({ request: { headers } });
  }

  // Pages publiques : réécriture vers /s/<slug>/…
  const url = req.nextUrl.clone();
  url.pathname = `${SITE_ROUTE_PREFIX}/${slug}${pathname === "/" ? "" : pathname}`;
  const res = NextResponse.rewrite(url, { request: { headers } });
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
