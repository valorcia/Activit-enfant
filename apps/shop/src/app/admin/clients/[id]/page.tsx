import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, AdminCard, StatusPill } from "@/components/admin/page-header";
import { formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("customers:read");
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, include: { _count: { select: { items: true } } } },
      entitlements: { include: { product: { select: { name: true } }, order: { select: { number: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) notFound();
  const [consents, subscriber, reviews] = await Promise.all([
    prisma.marketingConsent.findMany({ where: { email: customer.email }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.newsletterSubscriber.findFirst({ where: { email: customer.email }, orderBy: { updatedAt: "desc" } }),
    prisma.review.findMany({ where: { email: customer.email }, include: { product: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div>
      <AdminPageHeader title={customer.name ?? customer.email} description={customer.email} breadcrumbs={[{ label: "Clients", href: "/admin/clients" }, { label: customer.email }]} />
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="Commandes">
          {customer.orders.length === 0 ? <p className="text-sm text-ink-muted">Aucune commande.</p> : (
            <ul className="divide-y divide-line text-sm">
              {customer.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <span><Link href={`/admin/commandes/${o.id}`} className="font-bold hover:underline">{o.number}</Link> <span className="text-ink-muted">· {formatDateTime(o.createdAt)} · {o._count.items} article{o._count.items > 1 ? "s" : ""}</span></span>
                  <span className="flex items-center gap-2"><span className="font-bold">{formatPrice(o.totalCents, o.currency)}</span><StatusPill status={o.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
        <AdminCard title="Droits de téléchargement">
          {customer.entitlements.length === 0 ? <p className="text-sm text-ink-muted">Aucun droit.</p> : (
            <ul className="divide-y divide-line text-sm">
              {customer.entitlements.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <span>{e.product.name} <span className="text-ink-muted">· {e.order.number}</span></span>
                  <span className="text-xs text-ink-muted">{e.downloadCount}/{e.maxDownloads}{e.revokedAt ? " · révoqué" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
        <AdminCard title="Newsletter & consentements">
          <p className="text-sm">Newsletter : {subscriber ? <StatusPill status={subscriber.status} /> : <span className="text-ink-muted">non inscrit</span>}{subscriber?.confirmedAt ? <span className="ml-2 text-xs text-ink-muted">confirmé le {formatDateTime(subscriber.confirmedAt)}</span> : null}</p>
          <ul className="mt-3 space-y-1 text-xs">
            {consents.length === 0 ? <li className="text-ink-muted">Aucun consentement enregistré.</li> : consents.map((c) => (
              <li key={c.id}><span className={c.granted ? "font-bold text-sage-dark" : "font-bold text-red-700"}>{c.granted ? "Accordé" : "Retiré"}</span> · {c.purpose} · {formatDateTime(c.createdAt)}{c.source ? ` · ${c.source}` : ""}</li>
            ))}
          </ul>
        </AdminCard>
        <AdminCard title="Avis">
          {reviews.length === 0 ? <p className="text-sm text-ink-muted">Aucun avis.</p> : (
            <ul className="divide-y divide-line text-sm">
              {reviews.map((r) => <li key={r.id} className="flex items-center justify-between py-2"><span>{r.product.name} · {r.rating}/5</span><StatusPill status={r.status} /></li>)}
            </ul>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
