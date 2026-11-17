import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { PersonalItemActions } from "@/components/admin/unwritten-admin";
import { formatDateTime } from "@/lib/utils";
import { ITEM_STATUS_CLASSES, ITEM_STATUS_LABELS } from "@/lib/unwritten/admin";
import { displayAnswer } from "@/lib/unwritten/draft-view";
import { giftAnswers, itemAnswers, itemDefinition } from "@/lib/unwritten/orders";
import { visibleSteps } from "@/lib/unwritten/questionnaire/engine";

export const metadata = { title: "Livre personnalisé" };
export const dynamic = "force-dynamic";

/** Détail d'un livre commandé : statut, dates, brouillon figé (réponses), cadeau, fichier. */
export default async function PersonalItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("orders:read");
  const { id } = await params;
  const item = await prisma.personalOrderItem.findUnique({ where: { id }, include: { order: true, product: { select: { name: true, slug: true } }, gift: true, entitlement: true } });
  if (!item) notFound();
  const def = itemDefinition(item);
  const answers = { ...itemAnswers(item), ...(item.gift ? giftAnswers(item.gift) : {}) };
  const q = (item.questionnaire ?? {}) as { version?: number };
  const lang = item.locale === "fr" ? "fr" : "en";
  const dates: Array<[string, Date | null]> = [["Payé", item.order.paidAt], ["Production", item.productionStartedAt], ["Livré", item.deliveredAt], ["Annulé", item.cancelledAt], ["Dernière relance", item.remindedAt], ["Données effacées", item.dataPurgedAt]];
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`${item.product?.name ?? "Livre"} · ${item.order.number}`}
        breadcrumbs={[{ label: "Livres personnalisés", href: "/admin/unwritten" }, { label: item.order.number }]}
        actions={<Link href={`/admin/commandes/${item.orderId}`} className="text-sm font-bold underline">Voir la commande</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <AdminCard title="Brouillon figé (réponses au paiement)" description={`Questionnaire version ${q.version ?? "?"} · langue ${item.locale.toUpperCase()} · mode ${item.mode === "self" ? "pour soi" : item.mode === "gift" ? "cadeau rempli par l'acheteur" : "cadeau rempli par le destinataire"}`}>
          {item.dataPurgedAt ? <p className="text-sm text-ink-muted">Réponses effacées le {formatDateTime(item.dataPurgedAt)} (durée de conservation atteinte).</p> : !def ? <p className="text-sm">Définition indisponible.</p> : (
            <div className="space-y-5">
              {visibleSteps(def, answers).map(({ step, questions }) => (
                <div key={step.id}>
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{step.title.fr}</p>
                  <dl className="mt-2 divide-y divide-line rounded-xl border border-line bg-white">
                    {questions.filter((x) => x.type !== "info").map((x) => (
                      <div key={x.id} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[220px_1fr]">
                        <dt className="text-ink-soft">{x.label.fr}{x.sensitive && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">sensible</span>}</dt>
                        <dd className="whitespace-pre-line font-semibold">{displayAnswer(x, answers[x.id], lang) ?? <span className="font-normal text-ink-muted">—</span>}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
        <div className="space-y-6">
          <AdminCard title="Statut">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${ITEM_STATUS_CLASSES[item.status]}`}>{ITEM_STATUS_LABELS[item.status]}</span>
            {item.lastError && <p className="mt-3 rounded-xl bg-red-50 p-2 text-xs text-red-800">Dernière erreur du studio : {item.lastError}</p>}
            <dl className="mt-3 space-y-1 text-sm">
              {dates.filter(([, d]) => d).map(([l, d]) => <div key={l} className="flex justify-between gap-3"><dt className="text-ink-muted">{l}</dt><dd>{formatDateTime(d)}</dd></div>)}
              {item.studioRef && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Réf. studio</dt><dd className="font-mono text-xs">{item.studioRef}</dd></div>}
            </dl>
            {roleCan(user.role, "orders:refund") && <div className="mt-4"><PersonalItemActions itemId={item.id} status={item.status} giftPending={item.status === "AWAITING_RECIPIENT" && !!item.gift && !item.gift.completedAt} /></div>}
          </AdminCard>
          {item.gift && (
            <AdminCard title="Cadeau">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Prénom</dt><dd>{item.gift.recipientName ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">E-mail</dt><dd>{item.gift.recipientEmail ?? "transmis par l'acheteur"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Lien envoyé</dt><dd>{item.gift.sentAt ? formatDateTime(item.gift.sentAt) : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Ouvert</dt><dd>{item.gift.openedAt ? formatDateTime(item.gift.openedAt) : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Réponses envoyées</dt><dd>{item.gift.completedAt ? formatDateTime(item.gift.completedAt) : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Expire</dt><dd>{item.gift.expiresAt ? formatDateTime(item.gift.expiresAt) : "—"}</dd></div>
              </dl>
              {item.gift.message && <p className="mt-3 whitespace-pre-line rounded-xl bg-[#FBFAF7] p-2 text-sm italic">{item.gift.message}</p>}
            </AdminCard>
          )}
          <AdminCard title="Fichier final">
            {item.fileKey ? <p className="text-sm">{item.fileName} · {Math.round((item.fileSize ?? 0) / 1024)} Ko</p> : <p className="text-sm text-ink-muted">Pas encore déposé par le studio.</p>}
            {item.entitlement && <p className="mt-2 text-xs text-ink-muted">Téléchargements : {item.entitlement.downloadCount} / {item.entitlement.maxDownloads}{item.entitlement.revokedAt ? " · révoqué" : ""}</p>}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
