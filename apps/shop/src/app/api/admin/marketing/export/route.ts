import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { periodFromKey, productRoi, roiRowsToCsv } from "@/lib/social/roi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getAdminUser();
  if (!user || !roleCan(user.role, "marketing:write")) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const periode = new URL(req.url).searchParams.get("periode") ?? "30j";
  const rows = await productRoi(periodFromKey(periode));
  return new NextResponse(`﻿${roiRowsToCsv(rows)}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rentabilite-${periode}.csv"` } });
}
