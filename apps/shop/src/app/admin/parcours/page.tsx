import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { getFunnelStats, type FunnelStats } from "@/lib/admin/funnel";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { getAdminSite } from "@/lib/sites";
import { cn, formatPrice } from "@/lib/utils";

export const metadata = { title: "Parcours d'achat" };
export const dynamic = "force-dynamic";

const PERIODS = [
  { value: "aujourdhui", label: "Aujourd'hui", days: 0 },
  { value: "7j", label: "7 jours", days: 7 },
  { value: "30j", label: "30 jours", days: 30 },
  { value: "90j", label: "90 jours", days: 90 },
] as const;

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const fmtPct = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const DEVICE: Record<string, string> = { mobile: "Mobile", tablet: "Tablette", desktop: "Ordinateur" };

/** Conseils par étape : où regarder quand la perte est forte à cet endroit. */
const ADVICE: Record<string, string> = {
  product: "Les visiteurs repartent avant d'ouvrir une fiche produit : vérifiez la page d'arrivée de vos publicités (elle doit montrer directement le produit annoncé) et la clarté de l'accueil sur mobile.",
  intent: "Les fiches produit ne déclenchent pas l'achat : prix perçu, visuels, aperçu des pages, âge et durée, avis clients. Comparez les produits dans le tableau plus bas.",
  checkout: "Des visiteurs ajoutent au panier sans aller jusqu'au paiement : panier oublié, frais ou étape inattendue. Vérifiez le panier sur mobile.",
  paid: "Les visiteurs ouvrent la page de paiement sans payer : moyens de paiement proposés, confiance, refus de carte (voir « Paiements refusés »).",
};

function biggestDrop(steps: FunnelStats["steps"]) {
  let worst: { from: string; to: string; key: string; loss: number } | null = null;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1].count;
    if (prev < 5) continue; // trop peu de données pour conclure
    const loss = 100 - pct(steps[i].count, prev);
    if (!worst || loss > worst.loss) worst = { from: steps[i - 1].label, to: steps[i].label, key: steps[i].key, loss };
  }
  return worst;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 font-heading text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-ink-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            {head.map((h, i) => <th key={h} className={cn("py-2 pr-3 font-bold", i > 0 && "text-right")}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {r.map((c, j) => <td key={j} className={cn("py-2 pr-3", j > 0 && "text-right tabular-nums")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ParcoursPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requirePermission("dashboard:view");
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.value === sp.periode) ?? PERIODS[2];
  const adminSite = await getAdminSite();
  const to = new Date();
  const from = new Date(to);
  if (period.days === 0) from.setHours(0, 0, 0, 0);
  else from.setTime(to.getTime() - period.days * 86400_000);
  const s = await getFunnelStats({ siteId: adminSite?.id ?? null, from, to });

  const visits = s.steps[0].count;
  const worst = biggestDrop(s.steps);
  const maxStep = Math.max(1, ...s.steps.map((x) => x.count));
  const maxDay = Math.max(1, ...s.daily.map((d) => d.visits));
  const labelStep = Math.max(1, Math.ceil(s.daily.length / 10));
  const noData = visits === 0 && s.checkoutOutcomes.created === 0;

  return (
    <div>
      <AdminPageHeader
        title="Parcours d'achat"
        description={`Jusqu'où vont vos visiteurs, et où ils s'arrêtent${adminSite ? ` · ${adminSite.name}` : " · tous les univers"}.`}
        actions={
          <div className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-1">
            {PERIODS.map((p) => (
              <Link key={p.value} href={`/admin/parcours?periode=${p.value}`} className={cn("rounded-full px-3 py-1.5 text-sm font-bold", p.value === period.value ? "bg-ink text-white" : "text-ink-soft hover:bg-cream")}>{p.label}</Link>
            ))}
          </div>
        }
      />

      {noData && (
        <div className="mb-6 rounded-2xl border border-honey/60 bg-honey-light/40 p-4 text-sm">
          Pas encore de données sur cette période. La mesure démarre à la mise en ligne de cette page : les visites apparaissent dès les premières minutes. Les visiteurs qui refusent la mesure d&apos;audience dans le bandeau des cookies ne sont pas comptés.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Visites" value={visits.toLocaleString("fr-FR")} hint={`${s.visitors.toLocaleString("fr-FR")} visiteurs · ${s.pageViews.toLocaleString("fr-FR")} pages vues`} />
        <Kpi label="Clics « Acheter »" value={s.buyClicks.toLocaleString("fr-FR")} hint="Boutons « Acheter » et « Commander » du panier" />
        <Kpi label="Commandes payées" value={s.steps[4].count.toLocaleString("fr-FR")} hint={formatPrice(s.revenueCents)} />
        <Kpi label="Taux de conversion" value={fmtPct(pct(s.steps[4].count, visits))} hint="Commandes payées / visites" />
      </div>

      {worst && worst.loss > 0 && (
        <div className="mt-6 rounded-2xl border border-coral/40 bg-coral/10 p-5">
          <p className="font-heading text-lg font-bold">Où vous perdez le plus de monde</p>
          <p className="mt-1 text-sm">Entre « {worst.from} » et « {worst.to} » : <strong>{fmtPct(worst.loss)}</strong> des visiteurs s&apos;arrêtent.</p>
          {ADVICE[worst.key] && <p className="mt-2 text-sm text-ink-soft">{ADVICE[worst.key]}</p>}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <AdminCard title="L'entonnoir" description="Chaque étape compte les visites qui l'ont atteinte. Entre parenthèses : la part de l'étape précédente.">
          <ol className="space-y-4" aria-label="Entonnoir d'achat">
            {s.steps.map((step, i) => {
              const prev = i > 0 ? s.steps[i - 1].count : null;
              const lost = prev != null ? Math.max(0, prev - step.count) : 0;
              return (
                <li key={step.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-bold">{i + 1}. {step.label}</span>
                    <span className="tabular-nums text-ink-soft">
                      <strong className="text-ink">{step.count.toLocaleString("fr-FR")}</strong>
                      {prev != null && <> ({fmtPct(pct(step.count, prev))})</>}
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 w-full rounded-full bg-cream" title={`${step.label} : ${step.count} (${fmtPct(pct(step.count, visits))} des visites)`}>
                    <div className="h-3 rounded-full bg-coral" style={{ width: `${Math.max(step.count > 0 ? 1.5 : 0, (step.count / maxStep) * 100)}%` }} />
                  </div>
                  {prev != null && lost > 0 && <p className="mt-1 text-xs text-ink-muted">{lost.toLocaleString("fr-FR")} perdue(s) à cette étape</p>}
                </li>
              );
            })}
          </ol>
        </AdminCard>

        <AdminCard title="Ce qui se passe sur la page de paiement" description="Pages de paiement Stripe ouvertes sur la période.">
          <Table
            head={["Issue", "Nombre"]}
            empty="Aucune page de paiement ouverte sur la période."
            rows={s.checkoutOutcomes.created ? [
              ["Payées", s.checkoutOutcomes.paid],
              ["Abandonnées (page fermée sans payer)", s.checkoutOutcomes.abandoned],
              ["Paiement refusé", s.checkoutOutcomes.failed],
              ["En cours (moins de 2 h)", s.checkoutOutcomes.pending],
            ] : []}
          />
          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-ink-muted">Paiements refusés, par motif</p>
          <div className="mt-2">
            <Table head={["Motif", "Refus"]} empty="Aucun refus de paiement sur la période." rows={s.paymentFailures.map((f) => [f.label, f.count])} />
          </div>
        </AdminCard>
      </div>

      {s.daily.length > 1 && <AdminCard title="Visites par jour" className="mt-6">
        <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Visites par jour">
          {s.daily.map((d) => (
            <div key={d.day} className="group relative max-w-[48px] flex-1">
              <div className="w-full rounded-t-[4px] bg-coral/80 group-hover:bg-coral" style={{ height: `${d.visits ? Math.max(3, (d.visits / maxDay) * 150) : 0}px` }} />
              <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[11px] font-bold text-white group-hover:block">
                {d.day.split("-").reverse().slice(0, 2).join("/")} · {d.visits} visite(s){d.paid ? ` · ${d.paid} commande(s)` : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-[2px] text-[10px] text-ink-muted">
          {s.daily.map((d, i) => <span key={d.day} className="max-w-[48px] flex-1 truncate text-center">{i % labelStep === 0 ? d.day.split("-").reverse().slice(0, 2).join("/") : ""}</span>)}
        </div>
      </AdminCard>}

      <AdminCard title="Par produit" className="mt-6" description="Visites ayant vu la fiche, ajouté au panier, cliqué sur « Acheter » ; pages de paiement ouvertes et commandes payées contenant le produit.">
        <Table
          head={["Produit", "Vues", "Panier", "Clic Acheter", "Paiement ouvert", "Payées", "Conversion"]}
          empty="Aucune fiche produit vue sur la période."
          rows={s.byProduct.map((p) => [p.name, p.views, p.carts, p.buyClicks, p.checkouts, p.paid, p.views ? fmtPct(pct(p.paid, p.views)) : "—"])}
        />
      </AdminCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminCard title="D'où viennent les visites" description="Source de la première page de la visite (lien de campagne utm, publicité, site d'origine ou accès direct).">
          <Table head={["Source", "Visites", "Clic Acheter", "Taux"]} empty="Pas encore de visite mesurée." rows={s.bySource.map((r) => [r.source, r.visits, r.buyVisits, fmtPct(pct(r.buyVisits, r.visits))])} />
          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-ink-muted">Commandes payées, par lien de campagne</p>
          <div className="mt-2">
            <Table head={["Source", "Commandes", "Montant"]} empty="Aucune commande payée sur la période." rows={s.paidBySource.map((r) => [r.source, r.orders, formatPrice(r.revenueCents)])} />
          </div>
        </AdminCard>
        <div className="space-y-6">
          <AdminCard title="Par appareil">
            <Table head={["Appareil", "Visites", "Clic Acheter", "Taux"]} empty="Pas encore de visite mesurée." rows={s.byDevice.map((r) => [DEVICE[r.device] ?? r.device, r.visits, r.buyVisits, fmtPct(pct(r.buyVisits, r.visits))])} />
          </AdminCard>
          <AdminCard title="Où ils quittent le site" description="Dernière page vue des visites terminées sans clic « Acheter ».">
            <Table head={["Page", "Visites"]} empty="Pas encore de visite mesurée." rows={s.exitPages.map((r) => [<code key={r.path} className="text-xs">{r.path}</code>, r.visits])} />
          </AdminCard>
        </div>
      </div>

      <p className="mt-6 text-xs text-ink-muted">
        Mesure interne et anonyme : ni adresse IP, ni e-mail, aucun lien avec les fiches clients ; données conservées 25 mois. Les visiteurs qui refusent la mesure d&apos;audience ne sont pas comptés, et les robots sont exclus : les chiffres peuvent différer de ceux de Meta.
      </p>
    </div>
  );
}
