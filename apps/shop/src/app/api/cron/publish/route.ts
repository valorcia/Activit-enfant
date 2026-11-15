import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { publishScheduledProducts } from "@/lib/products/service";
import { runDailyCreatorJobs } from "@/lib/creators/commissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function isCronAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (env.cronSecret && auth === `Bearer ${env.cronSecret}`) return true;
  // Vercel Cron ajoute cet entête ; en production le CRON_SECRET reste recommandé.
  if (req.headers.get("x-vercel-cron") && (!env.cronSecret || !env.isProd)) return true;
  return false;
}

/**
 * Tâche quotidienne (Vercel Cron) : publication des produits et articles programmés, puis
 * commissions des créatrices (rattrapage, remboursements rejoués, confirmation après délai).
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const published = await publishScheduledProducts();
  let creators: Awaited<ReturnType<typeof runDailyCreatorJobs>> | { error: string };
  try {
    creators = await runDailyCreatorJobs();
  } catch (e) {
    console.error("[cron:creators]", e instanceof Error ? e.message : e);
    creators = { error: "Commissions des créatrices non traitées" };
  }
  return NextResponse.json({ ok: true, published, creators });
}
