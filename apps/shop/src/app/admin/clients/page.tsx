import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DataTable, AdminPagination } from "@/components/admin/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice } from "@/lib/utils";
import { adminSiteWhere } from "@/lib/sites";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePermission("customers:read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = 30;
  const siteWhere = await adminSiteWhere();
  // Univers sélectionné : clients ayant au moins une commande dans cet univers
  const where = {
    ...(sp.q ? { OR: [{ email: { contains: sp.q, mode: "insensitive" as const } }, { name: { contains: sp.q, mode: "insensitive" as const } }] } : {}),
    ...(siteWhere.siteId ? { orders: { some: { siteId: siteWhere.siteId } } } : {}),
  };
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage, include: { orders: { where: { ...siteWhere, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, select: { totalCents: true, refundedCents: true } } } }),
    prisma.customer.count({ where }),
  ]);
  return (
    <div>
      <AdminPageHeader title="Clients" description={`${total} client${total > 1 ? "s" : ""} (achat sans compte : identifiés par email)`} />
      <form className="mb-4 flex gap-2"><Input name="q" defaultValue={sp.q ?? ""} placeholder="Email ou nom" className="h-10 max-w-sm" aria-label="Recherche" /><Button type="submit" variant="admin" size="sm" className="h-10">Rechercher</Button></form>
      <DataTable
        rows={customers} rowKey={(c) => c.id} empty="Aucun client."
        columns={[
          { key: "email", header: "Email", render: (c) => <Link href={`/admin/clients/${c.id}`} className="font-bold hover:underline">{c.email}</Link> },
          { key: "name", header: "Nom", render: (c) => c.name ?? "—" },
          { key: "orders", header: "Commandes payées", render: (c) => c.orders.length },
          { key: "spent", header: "Total dépensé", className: "text-right", render: (c) => <span className="font-bold">{formatPrice(c.orders.reduce((s, o) => s + o.totalCents - o.refundedCents, 0))}</span> },
          { key: "since", header: "Depuis", render: (c) => <span className="text-ink-soft">{formatDate(c.createdAt)}</span> },
        ]}
      />
      <AdminPagination page={page} pages={Math.max(1, Math.ceil(total / perPage))} buildHref={(p) => `/admin/clients?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
    </div>
  );
}
