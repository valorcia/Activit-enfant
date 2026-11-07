import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DataTable, AdminPagination } from "@/components/admin/data-table";
import { formatDateTime } from "@/lib/utils";
import { MarkProcessedButton } from "@/components/admin/ops-newsletter-actions";

export const metadata = { title: "Événements marketing" };
export const dynamic = "force-dynamic";

export default async function MarketingEventsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("newsletter:read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = 50;
  const [events, total] = await Promise.all([
    prisma.marketingEvent.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
    prisma.marketingEvent.count(),
  ]);
  return (
    <div>
      <AdminPageHeader title="Événements marketing" breadcrumbs={[{ label: "Newsletter", href: "/admin/newsletter" }, { label: "Événements" }]} description="File d'événements (inscription, achat, panier abandonné, nouvelle publication) consommable par vos outils d'automatisation. Les tâches planifiées (/api/cron/marketing) traitent les annonces de nouveautés et les relances de paniers." />
      <DataTable
        rows={events} rowKey={(e) => e.id} empty="Aucun événement."
        columns={[
          { key: "date", header: "Date", render: (e) => <span className="text-xs text-ink-soft">{formatDateTime(e.createdAt)}</span> },
          { key: "type", header: "Type", render: (e) => <span className="font-mono text-xs font-bold">{e.type}</span> },
          { key: "email", header: "Email", render: (e) => e.email ?? "—" },
          { key: "payload", header: "Données", render: (e) => <code className="block max-w-md truncate text-xs text-ink-soft">{e.payload ? JSON.stringify(e.payload) : "—"}</code> },
          { key: "processed", header: "Traité", render: (e) => e.processedAt ? <span className="text-xs text-sage-dark font-bold">{formatDateTime(e.processedAt)}</span> : <MarkProcessedButton id={e.id} /> },
        ]}
      />
      <AdminPagination page={page} pages={Math.max(1, Math.ceil(total / perPage))} buildHref={(p) => `/admin/newsletter/evenements?page=${p}`} />
    </div>
  );
}
