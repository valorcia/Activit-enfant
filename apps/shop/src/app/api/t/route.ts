import { NextResponse, type NextRequest } from "next/server";
import { clientEventSchema, isBot, recordClientEvent } from "@/lib/analytics/events";
import { getRequestSite } from "@/lib/sites";

export const runtime = "nodejs";

const hits = new Map<string, { n: number; reset: number }>();
function limited(key: string): boolean {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.reset < now) {
    hits.set(key, { n: 1, reset: now + 60_000 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  cur.n += 1;
  return cur.n > 120; // 120 événements par minute et par adresse : largement au-dessus d'une navigation normale
}

/** Réception des événements de mesure d'audience (navigator.sendBeacon). Répond toujours 204. */
export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (isBot(ua) || (ip && limited(ip))) return new NextResponse(null, { status: 204 });
  try {
    const parsed = clientEventSchema.safeParse(JSON.parse(await req.text()));
    if (parsed.success) {
      const site = await getRequestSite();
      await recordClientEvent(site.id, parsed.data, { userAgent: ua, ownHost: req.headers.get("x-forwarded-host") ?? req.headers.get("host") });
    }
  } catch {
    /* corps illisible : ignoré */
  }
  return new NextResponse(null, { status: 204 });
}
