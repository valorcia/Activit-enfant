import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { formatPrice } from "@/lib/utils";
import { effectivePrice } from "@/lib/pricing";

export const metadata = { title: "Packs" };
export const dynamic = "force-dynamic";

export default async function BundlesPage() {
  await requirePermission("products:read");
  const bundles = await prisma.bundle.findMany({ orderBy: { updatedAt: "desc" }, include: { items: { include: { product: { select: { name: true, priceCents: true, salePriceCents: true, saleStartsAt: true, saleEndsAt: true } } } } } });
  return (
    <div>
      <AdminPageHeader title="Packs et offres groupées" description="Sélectionnez plusieurs produits et définissez un prix groupé. Le client reçoit tous les fichiers inclus."
        actions={<Button asChild variant="admin" size="sm"><Link href="/admin/packs/nouveau"><Plus className="size-4" /> Nouveau pack</Link></Button>} />
      <DataTable rows={bundles} rowKey={(b) => b.id} empty="Aucun pack. Créez par exemple « Pack 3 aventures » ou « Pack anniversaire »."
        columns={[
          { key: "name", header: "Pack", render: (b) => <div><Link href={`/admin/packs/${b.id}`} className="font-bold hover:underline">{b.name}</Link><p className="text-xs text-ink-muted">{b.items.map((i) => i.product.name).join(" + ")}</p></div> },
          { key: "status", header: "Statut", render: (b) => <StatusPill status={b.status} /> },
          { key: "price", header: "Prix", render: (b) => { const sum = b.items.reduce((s, i) => s + effectivePrice(i.product).priceCents, 0); return <span><strong>{formatPrice(b.priceCents, b.currency)}</strong> <span className="text-xs text-ink-muted">au lieu de {formatPrice(sum)} (−{sum > 0 ? Math.round((1 - b.priceCents / sum) * 100) : 0} %)</span></span>; } },
          { key: "sales", header: "Ventes", render: (b) => <span>{b.salesCount}</span> },
        ]} />
    </div>
  );
}
