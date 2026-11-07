import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { buildOrderWhere } from "@/lib/admin/orders-query";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export CSV des commandes (mêmes filtres que la liste). */
export async function GET(req: Request) {
  const user = await getAdminUser();
  if (!user || !roleCan(user.role, "orders:read")) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const orders = await prisma.order.findMany({ where: buildOrderWhere(sp), orderBy: { createdAt: "desc" }, take: 5000, include: { items: true } });
  const header = ["numero", "date", "statut", "email", "nom", "sous_total", "remise", "tva", "total", "rembourse", "devise", "code_promo", "facture", "articles"];
  const lines = orders.map((o) => [
    o.number, o.createdAt.toISOString(), o.status, o.email, o.billingName ?? "", (o.subtotalCents / 100).toFixed(2), (o.discountCents / 100).toFixed(2), (o.taxCents / 100).toFixed(2), (o.totalCents / 100).toFixed(2), (o.refundedCents / 100).toFixed(2), o.currency, o.couponCode ?? "", o.invoiceNumber ?? "",
    o.items.map((i) => `${i.name} x${i.quantity}`).join(" | "),
  ].map(csvCell).join(";"));
  const body = "﻿" + [header.join(";"), ...lines].join("\n");
  return new NextResponse(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
