import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, MessageSquareQuote, PackageX } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getDashboardStats, PERIODS, type Period } from "@/lib/admin/stats";
import { AdminPageHeader, AdminCard, StatusPill } from "@/components/admin/page-header";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";

export const metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

function delta(current: number, previous: number): { pct: number | null; up: boolean } {
  if (previous === 0) return { pct: current > 0 ? null : 0, up: current >= previous };
  return { pct: Math.round(((current - previous) / previous) * 100), up: current >= previous };
}

function Kpi({ label, value, hint, change }: { label: string; value: string; hint?: string; change?: { pct: number | null; up: boolean } }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 font-heading text-3xl font-bold">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
        {change && (
          <span className={cn("inline-flex items-center gap-0.5 font-bold", change.up ? "text-sage-dark" : "text-red-600")}>
            {change.up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {change.pct === null ? "nouveau" : `${change.pct > 0 ? "+" : ""}${change.pct} %`}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

function BarChart({ data, format }: { data: Array<{ label: string; value: number }>; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.max(1, Math.ceil(data.length / 12));
  return (
    <div>
      <div className="flex h-44 items-end gap-[2px]" role="img" aria-label="Évolution des ventes">
        {data.map((d, i) => (
          <div key={i} className="group relative flex-1">
            <div className="w-full rounded-t-md bg-coral/80 transition-colors group-hover:bg-coral" style={{ height: `${Math.max(2, (d.value / max) * 160)}px` }} />
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white group-hover:block">{d.label} · {format(d.value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-ink-muted">
        {data.map((d, i) => <span key={i} className="flex-1 truncate text-center">{i % step === 0 ? d.label : ""}</span>)}
      </div>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requirePermission("dashboard:view");
  const sp = await searchParams;
  const period = (PERIODS.some((p) => p.value === sp.periode) ? sp.periode : "30j") as Period;
  const s = await getDashboardStats(period);
  const totalCatalog = Object.values(s.catalog.byStatus).reduce((a, b) => a + b, 0);
  const alerts = [
    s.catalog.needsReview > 0 && { href: "/admin/produits?validation=1", icon: AlertTriangle, text: `${s.catalog.needsReview} produit(s) créé(s) via l'API en attente de validation` },
    s.pendingReviews > 0 && { href: "/admin/avis", icon: MessageSquareQuote, text: `${s.pendingReviews} avis client(s) à modérer` },
    s.catalog.withoutFiles > 0 && { href: "/admin/produits?statut=PUBLISHED", icon: PackageX, text: `${s.catalog.withoutFiles} produit(s) publié(s) sans fichier à livrer` },
  ].filter(Boolean) as Array<{ href: string; icon: typeof AlertTriangle; text: string }>;

  return (
    <div>
      <AdminPageHeader title="Tableau de bord" description="Vue d'ensemble des ventes et du catalogue."
        actions={<nav className="inline-flex rounded-full bg-white p-1 shadow-sm" aria-label="Période">{PERIODS.map((p) => <Link key={p.value} href={`/admin?periode=${p.value}`} className={cn("rounded-full px-3 py-1.5 text-xs font-bold", period === p.value ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5")}>{p.label}</Link>)}</nav>} />

      {alerts.length > 0 && (
        <ul className="mb-6 grid gap-2 sm:grid-cols-3">
          {alerts.map((a) => <li key={a.href}><Link href={a.href} className="flex items-center gap-2 rounded-xl border border-honey bg-honey-light px-4 py-3 text-sm font-semibold text-honey-dark hover:brightness-95"><a.icon className="size-4 shrink-0" /> {a.text}</Link></li>)}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Chiffre d'affaires" value={formatPrice(s.revenueCents)} hint="net des remboursements" change={delta(s.revenueCents, s.previous.revenueCents)} />
        <Kpi label="Commandes payées" value={String(s.orders)} change={delta(s.orders, s.previous.orders)} />
        <Kpi label="Panier moyen" value={formatPrice(s.averageOrderCents)} />
        <Kpi label="Taux de conversion" value={s.conversion.rate === null ? "—" : `${(s.conversion.rate * 100).toFixed(2)} %`} hint={s.conversion.rate === null ? "données de trafic insuffisantes" : `${s.conversion.ordersPaid} commandes / ${s.conversion.productViews} vues produit`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <AdminCard title="Ventes par période" description={`Chiffre d'affaires par ${period === "12m" ? "mois" : "jour"}`} className="xl:col-span-2">
          <BarChart data={s.series.map((d) => ({ label: d.label, value: d.revenueCents }))} format={(v) => formatPrice(v)} />
        </AdminCard>
        <AdminCard title="Ventes par catégorie">
          {s.byCategory.length === 0 ? <p className="text-sm text-ink-soft">Aucune vente sur la période.</p> : (
            <ul className="space-y-3">
              {s.byCategory.map((c) => { const total = s.byCategory.reduce((a, b) => a + b.revenueCents, 0) || 1; return (
                <li key={c.name}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">{c.name}</span><span>{formatPrice(c.revenueCents)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-ink/5"><div className="h-full rounded-full" style={{ width: `${Math.round((c.revenueCents / total) * 100)}%`, background: c.color ?? "#293241" }} /></div>
                </li>
              ); })}
            </ul>
          )}
        </AdminCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <AdminCard title="Produits les plus vendus" className="xl:col-span-1">
          {s.topProducts.length === 0 ? <p className="text-sm text-ink-soft">Aucune vente sur la période.</p> : (
            <ol className="space-y-2 text-sm">
              {s.topProducts.map((p, i) => (
                <li key={p.id || p.name} className="flex items-center gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink/5 text-xs font-bold">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.slug ? <Link href={`/admin/produits/${p.id}`} className="hover:underline">{p.name}</Link> : p.name}</span>
                  <span className="text-ink-muted">{p.quantity} ×</span>
                  <span className="font-bold">{formatPrice(p.revenueCents)}</span>
                </li>
              ))}
            </ol>
          )}
        </AdminCard>
        <AdminCard title="Commandes récentes" className="xl:col-span-2" actions={<Link href="/admin/commandes" className="text-sm font-bold underline">Toutes les commandes</Link>}>
          {s.recentOrders.length === 0 ? <p className="text-sm text-ink-soft">Aucune commande pour l&apos;instant.</p> : (
            <ul className="divide-y divide-line text-sm">
              {s.recentOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 py-2">
                  <Link href={`/admin/commandes/${o.id}`} className="font-bold hover:underline">{o.number}</Link>
                  <span className="min-w-0 flex-1 truncate text-ink-soft">{o.email}</span>
                  <span className="text-xs text-ink-muted">{o.itemCount} art. · {formatDateTime(o.createdAt)}</span>
                  <StatusPill status={o.status} />
                  <span className="font-bold">{formatPrice(o.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <AdminCard title="Catalogue" description={`${totalCatalog} produit${totalCatalog > 1 ? "s" : ""} au total`}>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {(["PUBLISHED", "SCHEDULED", "DRAFT", "ARCHIVED"] as const).map((st) => (
              <li key={st} className="rounded-xl bg-[#FBFAF7] p-3"><p className="font-heading text-2xl font-bold">{s.catalog.byStatus[st] ?? 0}</p><StatusPill status={st} /></li>
            ))}
          </ul>
          <Link href="/admin/produits/nouveau" className="mt-3 inline-block text-sm font-bold underline">Créer un produit</Link>
        </AdminCard>
        <AdminCard title="Évolution du catalogue" description="Produits publiés par mois (12 derniers mois)" className="xl:col-span-2">
          <BarChart data={s.catalog.publishedPerMonth.map((m) => ({ label: m.label, value: m.count }))} format={(v) => `${v} produit${v > 1 ? "s" : ""}`} />
          <p className="mt-2 text-xs text-ink-muted">Objectif : au moins un nouveau produit par semaine.</p>
        </AdminCard>
      </div>
    </div>
  );
}
