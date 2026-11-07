import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { publishScheduledProducts } from "@/lib/products/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function isCronAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (env.cronSecret && auth === `Bearer ${env.cronSecret}`) return true;
  // Vercel Cron ajoute cet entête ; en production le CRON_SECRET reste recommandé.
  if (req.headers.get("x-vercel-cron") && (!env.cronSecret || !env.isProd)) return true;
  return false;
}

/** Publication des produits et articles programmés (toutes les 15 minutes via Vercel Cron). */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const published = await publishScheduledProducts();
  return NextResponse.json({ ok: true, published });
}
