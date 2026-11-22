import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runMarketingJobs } from "@/lib/marketing/jobs";
import { purgeSiteEvents } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function isCronAuthorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization") ?? "";
  return Boolean(env.cronSecret) && auth === `Bearer ${env.cronSecret}`;
}

/** Tâches marketing planifiées : relance des paniers abandonnés, annonce des nouveautés, purge des statistiques anciennes. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const result = await runMarketingJobs();
    // Mesure d'audience : conservation limitée à 25 mois
    const statsPurged = await purgeSiteEvents().catch(() => 0);
    return NextResponse.json({ ok: true, ...result, statsPurged });
  } catch (e) {
    console.error("[cron:marketing]", e);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
