import Link from "next/link";
import { Download } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { DataTable, AdminPagination } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { SubscriberActions } from "@/components/admin/ops-newsletter-actions";

export const metadata = { title: "Newsletter" };
export const dynamic = "force-dynamic";

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ page?: string; statut?: string }> }) {
  await requirePermission("newsletter:read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = 50;
  const where: Prisma.NewsletterSubscriberWhereInput = sp.statut === "PENDING" || sp.statut === "CONFIRMED" || sp.statut === "UNSUBSCRIBED" ? { status: sp.statut } : {};
  const [subs, total, counts, consents] = await Promise.all([
    prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.groupBy({ by: ["status"], _count: true }),
    prisma.marketingConsent.count(),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <div>
      <AdminPageHeader title="Newsletter" description={`${count("CONFIRMED")} abonnés confirmés · ${count("PENDING")} en attente de confirmation · ${count("UNSUBSCRIBED")} désinscrits · ${consents} consentements enregistrés`}
        actions={<><Button asChild variant="outline" size="sm"><Link href="/admin/newsletter/evenements">Événements marketing</Link></Button><Button asChild variant="admin" size="sm"><a href="/api/admin/newsletter/export"><Download className="size-4" /> Export CSV (confirmés)</a></Button></>} />
      <nav className="mb-4 flex flex-wrap gap-2">
        {[["", "Tous"], ["CONFIRMED", "Confirmés"], ["PENDING", "En attente"], ["UNSUBSCRIBED", "Désinscrits"]].map(([s, l]) => <Link key={s} href={`/admin/newsletter${s ? `?statut=${s}` : ""}`} className={`rounded-full px-4 py-1.5 text-sm font-bold ${(sp.statut ?? "") === s ? "bg-ink text-white" : "bg-white border border-line"}`}>{l}</Link>)}
      </nav>
      <DataTable
        rows={subs} rowKey={(s) => s.id} empty="Aucun abonné."
        columns={[
          { key: "email", header: "Email", render: (s) => <span className="font-semibold">{s.email}</span> },
          { key: "name", header: "Prénom", render: (s) => s.firstName ?? "—" },
          { key: "status", header: "Statut", render: (s) => <StatusPill status={s.status} /> },
          { key: "source", header: "Source", render: (s) => s.source ?? "—" },
          { key: "dates", header: "Inscription / confirmation", render: (s) => <span className="text-xs text-ink-soft">{formatDateTime(s.createdAt)}{s.confirmedAt ? ` → ${formatDateTime(s.confirmedAt)}` : ""}{s.unsubscribedAt ? ` · désinscrit ${formatDateTime(s.unsubscribedAt)}` : ""}</span> },
          { key: "actions", header: "", render: (s) => s.status !== "UNSUBSCRIBED" ? <SubscriberActions id={s.id} /> : null },
        ]}
      />
      <AdminPagination page={page} pages={Math.max(1, Math.ceil(total / perPage))} buildHref={(p) => `/admin/newsletter?${new URLSearchParams({ ...(sp.statut ? { statut: sp.statut } : {}), page: String(p) })}`} />
    </div>
  );
}
