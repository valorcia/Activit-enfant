import Link from "next/link";
import type { CommissionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CreatorsNav, Pill } from "@/components/admin/creators/creators-nav";
import { CancelCommissionButton, CommissionsBulk } from "@/components/admin/ops-creators";
import { COMMISSION_STATUS_LABELS } from "@/lib/creators/commissions";
import { formatRate, getCreatorSettings } from "@/lib/creators/settings";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata = { title: "Commissions des créatrices" };
export const dynamic = "force-dynamic";

const STATUSES: CommissionStatus[] = ["PENDING", "CONFIRMED", "PAID", "CANCELLED"];

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ statut?: string; createur?: string }> }) {
  const user = await requirePermission("creators:read");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.statut as CommissionStatus) ? (sp.statut as CommissionStatus) : undefined;
  const where: Prisma.CommissionEntryWhereInput = { ...(status ? { status } : {}), ...(sp.createur ? { creatorId: sp.createur } : {}) };
  const [entries, sums, creators, settings] = await Promise.all([
    prisma.commissionEntry.findMany({
      where, orderBy: { createdAt: "desc" }, take: 300,
      include: { order: { select: { number: true, id: true, paidAt: true, status: true } }, product: { select: { name: true } }, creator: { select: { name: true, publicName: true } } },
    }),
    prisma.commissionEntry.groupBy({ by: ["status"], where: sp.createur ? { creatorId: sp.createur } : {}, _sum: { amountCents: true }, _count: true }),
    prisma.creator.findMany({ select: { id: true, name: true, publicName: true }, orderBy: { name: "asc" } }),
    getCreatorSettings(),
  ]);
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ statut: status, createur: sp.createur, ...patch }).filter(([, v]) => v) as Array<[string, string]>);
    return `/admin/createurs/commissions${q.size ? `?${q}` : ""}`;
  };
  const canWrite = roleCan(user.role, "creators:write");
  const pendingIds = entries.filter((e) => e.status === "PENDING").map((e) => e.id);

  return (
    <div>
      <AdminPageHeader title="Commissions" description={`Une ligne par produit de créatrice vendu. Confirmation automatique après ${settings.confirmationDelayDays} jours (tâche quotidienne) ; un remboursement annule ou réduit la commission.`} />
      <CreatorsNav current="/admin/createurs/commissions" />
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUSES.map((s) => {
          const g = sums.find((x) => x.status === s);
          return <div key={s} className="rounded-2xl border border-line bg-white p-4"><dt className="text-xs font-bold text-ink-muted">{COMMISSION_STATUS_LABELS[s]}</dt><dd className="mt-1 font-heading text-xl font-bold">{formatPrice(g?._sum.amountCents ?? 0)}</dd><dd className="text-xs text-ink-muted">{g?._count ?? 0} ligne(s)</dd></div>;
        })}
      </dl>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={href({ statut: undefined })} className={`rounded-full px-3 py-1 text-xs font-bold ${!status ? "bg-coral text-white" : "border border-line bg-white"}`}>Tous statuts</Link>
        {STATUSES.map((s) => <Link key={s} href={href({ statut: s })} className={`rounded-full px-3 py-1 text-xs font-bold ${status === s ? "bg-coral text-white" : "border border-line bg-white"}`}>{COMMISSION_STATUS_LABELS[s]}</Link>)}
        <form className="ml-auto flex items-center gap-2" action="/admin/createurs/commissions">
          {status && <input type="hidden" name="statut" value={status} />}
          <select name="createur" defaultValue={sp.createur ?? ""} className="h-9 rounded-xl border border-line bg-white px-3 text-sm" aria-label="Créatrice">
            <option value="">Toutes les créatrices</option>
            {creators.map((c) => <option key={c.id} value={c.id}>{c.publicName ?? c.name}</option>)}
          </select>
          <button className="h-9 rounded-xl bg-ink px-3 text-sm font-bold text-white">Filtrer</button>
        </form>
      </div>
      {canWrite && <div className="mb-4"><CommissionsBulk pendingIds={pendingIds} /></div>}
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center text-sm text-ink-soft">Aucune commission pour ces filtres.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[#FBFAF7] text-left text-xs font-bold uppercase tracking-wide text-ink-muted">
              <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Commande</th><th className="px-3 py-2">Créatrice</th><th className="px-3 py-2">Produit</th><th className="px-3 py-2 text-right">Base HT</th><th className="px-3 py-2 text-right">Taux</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(e.order.paidAt ?? e.createdAt)}</td>
                  <td className="px-3 py-2"><Link href={`/admin/commandes/${e.order.id}`} className="font-semibold hover:underline">{e.order.number}</Link>{e.kind === "ADJUSTMENT" && <span className="ml-1 text-xs text-ink-muted">(régularisation)</span>}</td>
                  <td className="px-3 py-2">{e.creator.publicName ?? e.creator.name}</td>
                  <td className="px-3 py-2">{e.product?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatPrice(e.baseCents, e.currency)}{e.baseCents !== e.originalBaseCents && e.kind !== "ADJUSTMENT" && <span className="block text-xs text-ink-muted line-through">{formatPrice(e.originalBaseCents, e.currency)}</span>}</td>
                  <td className="px-3 py-2 text-right">{formatRate(e.rateBp)}</td>
                  <td className="px-3 py-2 text-right font-bold whitespace-nowrap">{formatPrice(e.amountCents, e.currency)}</td>
                  <td className="px-3 py-2"><Pill status={e.status} label={COMMISSION_STATUS_LABELS[e.status]} /></td>
                  <td className="px-3 py-2 text-right">{canWrite && (e.status === "PENDING" || e.status === "CONFIRMED") && <CancelCommissionButton id={e.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
