import Link from "next/link";
import type { PersonalItemStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";
import { adminPersonalizedSites, ITEM_STATUS_CLASSES, ITEM_STATUS_LABELS } from "@/lib/unwritten/admin";

export const metadata = { title: "Livres personnalisés" };
export const dynamic = "force-dynamic";

const STATUSES = Object.keys(ITEM_STATUS_LABELS) as PersonalItemStatus[];

/** Commandes personnalisées : un livre par ligne, du paiement à la livraison. */
export default async function PersonalItemsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await requirePermission("orders:read");
  const sp = await searchParams;
  const sites = await adminPersonalizedSites();
  if (!sites.length) return <div><AdminPageHeader title="Livres personnalisés" /><EmptyState title="Aucune marque personnalisée" description="Sélectionnez une marque personnalisée (UNWRITTEN) ou « Tous les univers » dans le sélecteur." /></div>;
  const status = STATUSES.includes(sp.statut as PersonalItemStatus) ? (sp.statut as PersonalItemStatus) : null;
  const where: Prisma.PersonalOrderItemWhereInput = { siteId: { in: sites.map((s) => s.id) }, ...(status ? { status } : {}) };
  const [items, counts] = await Promise.all([
    prisma.personalOrderItem.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { order: { select: { number: true, email: true } }, product: { select: { name: true } }, gift: { select: { openedAt: true, completedAt: true } } } }),
    prisma.personalOrderItem.groupBy({ by: ["status"], where: { siteId: { in: sites.map((s) => s.id) } }, _count: true }),
  ]);
  const count = (s: PersonalItemStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <div>
      <AdminPageHeader title="Livres personnalisés" description="Créés au paiement confirmé (webhook Stripe), produits par le studio via l'API v1, livrés individuellement." />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filtrer par statut">
        <Link href="/admin/unwritten" className={`rounded-full px-3 py-1.5 text-xs font-bold ${!status ? "bg-ink text-white" : "bg-white border border-line"}`}>Tous</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/unwritten?statut=${s}`} className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === s ? "bg-ink text-white" : "bg-white border border-line"}`}>{ITEM_STATUS_LABELS[s]} · {count(s)}</Link>
        ))}
      </nav>
      <DataTable
        rows={items}
        rowKey={(i) => i.id}
        empty="Aucun livre commandé pour ce filtre."
        columns={[
          { key: "order", header: "Commande", render: (i) => <Link href={`/admin/unwritten/${i.id}`} className="font-bold hover:underline">{i.order.number}</Link> },
          { key: "product", header: "Livre", render: (i) => <span>{i.product?.name ?? "—"}<span className="block text-xs text-ink-muted">{i.locale.toUpperCase()}{i.isGift ? " · cadeau" : ""}</span></span> },
          { key: "client", header: "Client", render: (i) => <span className="text-ink-soft">{i.order.email || "—"}</span> },
          { key: "status", header: "Statut", render: (i) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${ITEM_STATUS_CLASSES[i.status]}`}>{ITEM_STATUS_LABELS[i.status]}</span> },
          { key: "gift", header: "Destinataire", render: (i) => i.mode === "gift_recipient" ? <span className="text-xs">{i.gift?.completedAt ? "A répondu" : i.gift?.openedAt ? "Lien ouvert" : "Lien non ouvert"}</span> : <span className="text-xs text-ink-muted">—</span> },
          { key: "date", header: "Payé le", render: (i) => <span className="text-ink-soft">{formatDateTime(i.createdAt)}</span> },
          { key: "err", header: "Erreurs", className: "text-right", render: (i) => (i.errorCount ? <span className="font-bold text-red-700">{i.errorCount}</span> : "—") },
        ]}
      />
    </div>
  );
}
