import { NextResponse } from "next/server";
import { z } from "zod";
import { recordProductView } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ productId: z.string().min(1).max(64) });

/** Comptabilise une vue de fiche produit (statistiques internes, sans cookie). */
export async function POST(req: Request) {
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  await recordProductView(parsed.data.productId);
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
