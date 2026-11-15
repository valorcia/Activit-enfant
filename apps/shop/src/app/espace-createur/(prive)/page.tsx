import Link from "next/link";
import { Lightbulb, PlusCircle, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCreatorWithContract } from "@/lib/creators/session";
import { COMMISSION_STATUS_LABELS } from "@/lib/creators/commissions";
import { getCreatorSettings } from "@/lib/creators/settings";
import { siteAbsoluteUrl } from "@/lib/sites";
import { SubmissionStatusBadge } from "@/components/creator/status-badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata = { title: "Tableau de bord" };

export default async function CreatorDashboard() {
  const creator = await requireCreatorWithContract();
  const [sums, products, recent, payouts, actionable, settings] = await Promise.all([
    prisma.commissionEntry.groupBy({ by: ["status"], where: { creatorId: creator.id }, _sum: { amountCents: true } }),
    prisma.product.findMany({ where: { creatorId: creator.id }, select: { id: true, name: true, slug: true, status: true, site: { select: { primaryDomain: true, domains: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.commissionEntry.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 20, include: { product: { select: { name: true } } } }),
    prisma.creatorPayout.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.creatorSubmission.findMany({ where: { creatorId: creator.id, status: { in: ["PREVIEW_READY", "CHANGES_REQUESTED"] } }, select: { id: true, title: true, status: true } }),
    getCreatorSettings(),
  ]);
  const perProduct = await prisma.commissionEntry.groupBy({ by: ["productId"], where: { creatorId: creator.id, kind: "ROYALTY", status: { not: "CANCELLED" } }, _count: true, _sum: { amountCents: true } });
  const total = (s: string) => sums.find((x) => x.status === s)?._sum.amountCents ?? 0;
  const sales = perProduct.reduce((n, p) => n + p._count, 0);

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold">Bonjour {creator.publicName ?? creator.name.split(" ")[0]} 👋</h1>
      {!creator.publicName && <Alert variant="info" className="mt-4">Choisissez votre pseudo public dans <Link href="/espace-createur/profil" className="font-bold underline">Mon profil</Link> : il apparaîtra sur vos tutoriels.</Alert>}
      {!creator.ibanLast4 && total("CONFIRMED") + total("PENDING") > 0 && <Alert variant="warning" className="mt-4">Renseignez votre IBAN dans <Link href="/espace-createur/profil" className="font-bold underline">Mon profil</Link> pour recevoir vos paiements.</Alert>}
      {actionable.map((a) => (
        <Alert key={a.id} variant={a.status === "PREVIEW_READY" ? "success" : "warning"} className="mt-4">
          <Link href={`/espace-createur/idees/${a.id}`} className="font-bold underline">{a.title}</Link> — {a.status === "PREVIEW_READY" ? "l'aperçu attend votre validation." : "une modification vous est demandée."}
        </Alert>
      ))}

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card-soft p-4"><dt className="text-xs font-bold text-ink-muted">Ventes</dt><dd className="mt-1 font-heading text-2xl font-bold">{sales}</dd></div>
        <div className="card-soft p-4"><dt className="text-xs font-bold text-ink-muted">En attente</dt><dd className="mt-1 font-heading text-2xl font-bold">{formatPrice(total("PENDING"))}</dd><dd className="text-[11px] text-ink-muted">confirmées après {settings.confirmationDelayDays} jours</dd></div>
        <div className="card-soft p-4"><dt className="text-xs font-bold text-ink-muted">Confirmées</dt><dd className="mt-1 font-heading text-2xl font-bold">{formatPrice(total("CONFIRMED"))}</dd><dd className="text-[11px] text-ink-muted">payées dès {formatPrice(settings.payoutThresholdCents)}</dd></div>
        <div className="card-soft p-4"><dt className="text-xs font-bold text-ink-muted">Déjà payées</dt><dd className="mt-1 font-heading text-2xl font-bold">{formatPrice(total("PAID"))}</dd></div>
      </dl>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold">Mes tutoriels</h2>
          <Button asChild size="sm"><Link href="/espace-createur/idees/nouvelle"><PlusCircle className="size-4" /> Proposer une idée</Link></Button>
        </div>
        {products.length === 0 ? (
          <p className="card-soft mt-3 flex items-center gap-3 p-5 text-sm text-ink-soft"><Lightbulb className="size-6 shrink-0 text-honey-dark" /> Vos tutoriels apparaîtront ici dès leur mise en vente. <Link href="/espace-createur/idees" className="font-bold underline">Suivre mes idées</Link></p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {products.map((p) => {
              const st = perProduct.find((x) => x.productId === p.id);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0">{p.status === "PUBLISHED" ? <a href={siteAbsoluteUrl(p.site, `/aventures/${p.slug}`)} target="_blank" rel="noopener" className="font-bold hover:underline">{p.name}</a> : <span className="font-bold">{p.name}</span>} <span className="text-xs text-ink-muted">{p.status === "PUBLISHED" ? "en vente" : "bientôt en vente"}</span></span>
                  <span className="text-ink-soft">{st?._count ?? 0} vente(s) · <strong className="text-ink">{formatPrice(st?._sum.amountCents ?? 0)}</strong></span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-heading text-xl font-bold">Dernières commissions</h2>
          {recent.length === 0 ? <p className="mt-3 text-sm text-ink-soft">Aucune vente pour l&apos;instant.</p> : (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0"><span className="block truncate font-semibold">{e.product?.name ?? "Produit"}{e.kind === "ADJUSTMENT" ? " (régularisation)" : ""}</span><span className="text-xs text-ink-muted">{formatDate(e.createdAt)} · {COMMISSION_STATUS_LABELS[e.status]}</span></span>
                  <span className={e.status === "CANCELLED" ? "text-ink-muted line-through" : "font-bold"}>{formatPrice(e.status === "CANCELLED" ? e.originalAmountCents : e.amountCents, e.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold"><Wallet className="size-5" /> Paiements</h2>
          {payouts.length === 0 ? <p className="mt-3 text-sm text-ink-soft">Les paiements sont faits chaque mois par virement, dès {formatPrice(settings.payoutThresholdCents)} de commissions confirmées.</p> : (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span><span className="block font-semibold">{p.period}</span><span className="text-xs text-ink-muted">{p.status === "PAID" ? `Virement du ${formatDate(p.paidAt)}` : "Virement en préparation"}</span></span>
                  <span className="font-bold">{formatPrice(p.totalCents, p.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
