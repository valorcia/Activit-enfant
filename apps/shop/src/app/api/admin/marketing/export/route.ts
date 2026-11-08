import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { periodFromKey, productRoi, roiRowsToCsv } from "@/lib/social/roi";
import { prisma } from "@/lib/db";
import { getAdminSite } from "@/lib/sites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getAdminUser();
  if (!user || !roleCan(user.role, "marketing:write")) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const periode = sp.get("periode") ?? "30j";
  const audienceSlug = sp.get("audience");
  const [site, audience] = await Promise.all([getAdminSite(), audienceSlug ? prisma.audience.findUnique({ where: { slug: audienceSlug }, select: { id: true } }) : null]);
  const rows = await productRoi(periodFromKey(periode), undefined, { siteId: site?.id ?? null, audienceId: audience?.id ?? null });
  return new NextResponse(`﻿${roiRowsToCsv(rows)}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rentabilite-${periode}.csv"` } });
}
