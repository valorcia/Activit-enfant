import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { CreatorsNav, CREATOR_STATUS_LABELS, Pill } from "@/components/admin/creators/creators-nav";
import { CreatorControls, InviteCreatorForm, ProductRateControl } from "@/components/admin/ops-creators";
import { CONTRACT_VERSION } from "@/lib/creators/contract";
import { formatRate, getCreatorSettings } from "@/lib/creators/settings";
import { maskIban } from "@/lib/creators/iban";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata = { title: "Créatrices" };
export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const user = await requirePermission("creators:read");
  const canWrite = roleCan(user.role, "creators:write");
  const [creators, totals, toModerate, settings] = await Promise.all([
    prisma.creator.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        products: { select: { id: true, name: true, slug: true, status: true, creatorRateBp: true, salesCount: true }, orderBy: { createdAt: "desc" } },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.commissionEntry.groupBy({ by: ["creatorId", "status"], _sum: { amountCents: true } }),
    prisma.creatorSubmission.count({ where: { status: "SUBMITTED" } }),
    getCreatorSettings(),
  ]);
  const sum = (creatorId: string, status: string) => totals.find((t) => t.creatorId === creatorId && t.status === status)?._sum.amountCents ?? 0;

  return (
    <div>
      <AdminPageHeader title="Créatrices" description={`Programme sur invitation (phase 1). Taux par défaut : ${formatRate(settings.ideaRateBp)} (idée seule), ${formatRate(settings.fullTutorialRateBp)} (tutoriel complet), +${settings.exclusivityBonusBp / 100} points en exclusivité.`} />
      <CreatorsNav current="/admin/createurs" badges={{ "/admin/createurs/moderation": toModerate }} />

      {canWrite && (
        <AdminCard title="Inviter une créatrice" description="Elle reçoit un lien personnel pour accéder à son espace, accepter le contrat et proposer ses idées." className="mb-6">
          <InviteCreatorForm />
        </AdminCard>
      )}

      {creators.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center text-sm text-ink-soft">Aucune créatrice pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-3">
          {creators.map((c) => (
            <li key={c.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-lg font-bold">{c.name}</span>
                    <Pill status={c.status} label={CREATOR_STATUS_LABELS[c.status]} />
                    {c.publicName && <span className="text-sm text-ink-soft">pseudo « {c.publicName} »</span>}
                  </p>
                  <p className="mt-1 break-all text-xs text-ink-muted">{c.email} · invitée le {formatDate(c.invitedAt)}{c.lastLoginAt ? ` · dernière connexion ${formatDate(c.lastLoginAt)}` : " · jamais connectée"}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Contrat : {c.contractVersion ? `${c.contractVersion === CONTRACT_VERSION ? "accepté" : `ancienne version (${c.contractVersion})`} le ${formatDate(c.contractAcceptedAt)}` : "non accepté"}
                    {" · "}IBAN : {c.ibanLast4 ? maskIban(c.ibanLast4) : "non renseigné"}
                    {" · "}Taux : {c.defaultRateBp != null ? formatRate(c.defaultRateBp) : "selon l'apport"}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-right text-xs">
                  <div><dt className="text-ink-muted">En attente</dt><dd className="font-bold">{formatPrice(sum(c.id, "PENDING"))}</dd></div>
                  <div><dt className="text-ink-muted">Confirmées</dt><dd className="font-bold">{formatPrice(sum(c.id, "CONFIRMED"))}</dd></div>
                  <div><dt className="text-ink-muted">Payées</dt><dd className="font-bold">{formatPrice(sum(c.id, "PAID"))}</dd></div>
                </dl>
              </div>
              {canWrite && <div className="mt-3 border-t border-line pt-3"><CreatorControls id={c.id} status={c.status} defaultRateBp={c.defaultRateBp} hasContract={Boolean(c.contractVersion)} /></div>}
              <div className="mt-3 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{c._count.submissions} proposition(s) · {c.products.length} produit(s) crédité(s)</p>
                {c.products.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {c.products.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <Link href={`/admin/produits/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>
                        <span className="text-xs text-ink-muted">{p.status === "PUBLISHED" ? "en vente" : p.status.toLowerCase()} · {p.salesCount} vente(s) · taux {p.creatorRateBp != null ? formatRate(p.creatorRateBp) : "de la créatrice"}</span>
                        {canWrite && <ProductRateControl productId={p.id} rateBp={p.creatorRateBp} />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
