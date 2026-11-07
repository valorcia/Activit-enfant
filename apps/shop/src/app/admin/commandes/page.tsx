import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { DataTable, AdminPagination } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { buildOrderWhere, ORDER_STATUSES as STATUSES } from "@/lib/admin/orders-query";

export const metadata = { title: "Commandes" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("orders:read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = 25;
  const where = buildOrderWhere(sp);
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage, include: { _count: { select: { items: true } } } }),
    prisma.order.count({ where }),
  ]);
  const qs = (p: number) => `/admin/commandes?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.statut ? { statut: sp.statut } : {}), ...(sp.periode ? { periode: sp.periode } : {}), page: String(p) }).toString()}`;
  const exportHref = `/api/admin/orders/export?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.statut ? { statut: sp.statut } : {}), ...(sp.periode ? { periode: sp.periode } : {}) }).toString()}`;

  return (
    <div>
      <AdminPageHeader title="Commandes" description={`${total} commande${total > 1 ? "s" : ""}`} actions={<Button asChild variant="outline" size="sm"><a href={exportHref}><Download className="size-4" /> Export CSV</a></Button>} />
      <form className="mb-4 grid gap-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Numéro, email, nom…" aria-label="Recherche" className="h-10" />
        <NativeSelect name="statut" defaultValue={sp.statut ?? ""} aria-label="Statut" className="h-10">
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </NativeSelect>
        <NativeSelect name="periode" defaultValue={sp.periode ?? ""} aria-label="Période" className="h-10">
          <option value="">Toute période</option>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
          <option value="365">12 derniers mois</option>
        </NativeSelect>
        <Button type="submit" variant="admin" size="sm" className="h-10">Filtrer</Button>
      </form>
      <DataTable
        rows={orders}
        rowKey={(o) => o.id}
        empty="Aucune commande ne correspond."
        columns={[
          { key: "number", header: "Commande", render: (o) => <Link href={`/admin/commandes/${o.id}`} className="font-bold hover:underline">{o.number}</Link> },
          { key: "date", header: "Date", render: (o) => <span className="text-ink-soft">{formatDateTime(o.createdAt)}</span> },
          { key: "email", header: "Client", render: (o) => <span>{o.billingName ? `${o.billingName} · ` : ""}{o.email || "—"}</span> },
          { key: "items", header: "Articles", render: (o) => o._count.items },
          { key: "total", header: "Total", className: "text-right", render: (o) => <span className="font-bold">{formatPrice(o.totalCents, o.currency)}{o.refundedCents > 0 ? <span className="block text-xs font-normal text-ink-muted">remb. {formatPrice(o.refundedCents, o.currency)}</span> : null}</span> },
          { key: "status", header: "Statut", render: (o) => <StatusPill status={o.status} /> },
        ]}
      />
      <AdminPagination page={page} pages={Math.max(1, Math.ceil(total / perPage))} buildHref={qs} />
    </div>
  );
}
