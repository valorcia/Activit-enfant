import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/** Export CSV des abonnés confirmés (email, prénom, source, date de confirmation). */
export async function GET() {
  const user = await getAdminUser();
  if (!user || !roleCan(user.role, "newsletter:read")) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const subs = await prisma.newsletterSubscriber.findMany({ where: { status: "CONFIRMED" }, orderBy: { confirmedAt: "desc" } });
  const esc = (v: string | null | undefined) => { const s = v ?? ""; return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = "﻿" + ["email;prenom;source;confirme_le", ...subs.map((s) => [s.email, s.firstName, s.source, s.confirmedAt?.toISOString() ?? ""].map(esc).join(";"))].join("\n");
  return new NextResponse(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="abonnes-newsletter.csv"` } });
}
