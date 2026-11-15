import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { CreatorsNav, Pill } from "@/components/admin/creators/creators-nav";
import { MarkPaidForm, PreparePayoutsButton } from "@/components/admin/ops-creators";
import { getCreatorSettings } from "@/lib/creators/settings";
import { maskIban } from "@/lib/creators/iban";
import { periodOf } from "@/lib/creators/payouts";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata = { title: "Paiements des créatrices" };
export const dynamic = "force-dynamic";

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requirePermission("creators:payouts");
  const sp = await searchParams;
  const current = periodOf(new Date());
  const period = sp.periode && /^\d{4}-\d{2}$/.test(sp.periode) ? sp.periode : current;
  const [settings, available, payouts, periods] = await Promise.all([
    getCreatorSettings(),
    prisma.commissionEntry.groupBy({ by: ["creatorId"], where: { status: "CONFIRMED", payoutId: null }, _sum: { amountCents: true }, _count: true }),
    prisma.creatorPayout.findMany({ where: { period }, orderBy: { createdAt: "asc" }, include: { creator: { select: { name: true, publicName: true, ibanLast4: true, ibanHolder: true } }, _count: { select: { entries: true } } } }),
    prisma.creatorPayout.groupBy({ by: ["period"], _sum: { totalCents: true }, orderBy: { period: "desc" }, take: 24 }),
  ]);
  const creators = await prisma.creator.findMany({ where: { id: { in: available.map((a) => a.creatorId) } }, select: { id: true, name: true, publicName: true, ibanLast4: true } });
  const threshold = formatPrice(settings.payoutThresholdCents);

  return (
    <div>
      <AdminPageHeader title="Paiements" description={`Virement manuel mensuel des commissions confirmées, à partir de ${threshold} par créatrice (sinon report au mois suivant).`} actions={<PreparePayoutsButton thresholdLabel={threshold} />} />
      <CreatorsNav current="/admin/createurs/paiements" />

      <AdminCard title="Commissions confirmées non encore réglées" className="mb-5">
        {available.length === 0 ? <p className="text-sm text-ink-soft">Rien à préparer pour l&apos;instant.</p> : (
          <ul className="divide-y divide-line text-sm">
            {available.map((a) => {
              const c = creators.find((x) => x.id === a.creatorId);
              const total = a._sum.amountCents ?? 0;
              return (
                <li key={a.creatorId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-semibold">{c?.publicName ?? c?.name}</span>
                  <span className="text-ink-muted">{a._count} commission(s){!c?.ibanLast4 ? " · IBAN manquant" : ""}</span>
                  <span className={total >= settings.payoutThresholdCents ? "font-bold" : "text-ink-muted"}>{formatPrice(total)}{total < settings.payoutThresholdCents ? " (sous le seuil)" : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </AdminCard>

      <AdminCard
        title={`Paiements de ${period}`}
        description="L'export contient l'IBAN déchiffré : à conserver en lieu sûr et supprimer après le virement. Chaque export est journalisé."
        actions={payouts.length > 0 ? <a href={`/api/admin/createurs/paiements/export?periode=${period}`} className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white"><Download className="size-3.5" /> Export CSV</a> : undefined}
      >
        {periods.length > 1 && (
          <nav className="mb-3 flex flex-wrap gap-2" aria-label="Périodes">
            {periods.map((p) => <Link key={p.period} href={`/admin/createurs/paiements?periode=${p.period}`} className={`rounded-full px-3 py-1 text-xs font-bold ${p.period === period ? "bg-coral text-white" : "border border-line bg-white"}`}>{p.period} · {formatPrice(p._sum.totalCents ?? 0)}</Link>)}
          </nav>
        )}
        {payouts.length === 0 ? <p className="text-sm text-ink-soft">Aucun paiement préparé pour cette période. Cliquez sur « Préparer les paiements ».</p> : (
          <ul className="space-y-3">
            {payouts.map((p) => (
              <li key={p.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{p.creator.publicName ?? p.creator.name} <span className="font-normal text-ink-muted">· {p.creator.name}</span></p>
                    <p className="text-xs text-ink-muted">{p._count.entries} commission(s) · {p.creator.ibanLast4 ? `${p.creator.ibanHolder ?? ""} ${maskIban(p.creator.ibanLast4)}` : "IBAN manquant"}</p>
                  </div>
                  <p className="font-heading text-lg font-bold">{formatPrice(p.totalCents, p.currency)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Pill status={p.status} label={p.status === "PAID" ? "Payé" : "À payer"} />
                  {p.status === "PAID" ? <span className="text-xs text-ink-muted">Virement « {p.reference} » du {formatDate(p.paidAt)}</span> : <MarkPaidForm id={p.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
