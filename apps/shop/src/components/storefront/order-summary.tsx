import Link from "next/link";
import { AlertTriangle, Download, FileText, Receipt, ShoppingBag } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { downloadUrl } from "@/lib/orders/access";
import { formatBytes, formatDateTime, formatPrice } from "@/lib/utils";
import { StatusPill } from "@/components/admin/page-header";

export const orderSummaryInclude = {
  items: true,
  entitlements: {
    include: {
      product: { select: { id: true, name: true, slug: true, files: { select: { id: true, name: true, kind: true, sizeBytes: true, description: true, position: true }, orderBy: { position: "asc" } } } },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderSummaryData = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;

const FILE_KIND_LABEL: Record<string, string> = { MAIN_PDF: "Fichier principal", EXTRA_PDF: "Complément", INSTRUCTIONS: "Instructions", BONUS: "Bonus" };

export function OrderStatusNotice({ status }: { status: OrderSummaryData["status"] }) {
  if (status === "PAID" || status === "PARTIALLY_REFUNDED") return null;
  if (status === "PENDING") return <Alert variant="warning" title="Paiement en cours de confirmation">Vos fichiers seront disponibles dès que Stripe aura confirmé le paiement. Vous recevrez aussi un email.</Alert>;
  if (status === "REFUNDED") return <Alert variant="info" title="Commande remboursée">Cette commande a été intégralement remboursée ; les téléchargements ne sont plus disponibles.</Alert>;
  return <Alert variant="danger" title="Paiement non abouti">Cette commande n&apos;a pas été payée. Vous pouvez recommencer depuis le panier.</Alert>;
}

/** Récapitulatif de commande + téléchargements par produit et fichier. */
export function OrderSummary({ order, invoiceHref, showDownloads = true }: { order: OrderSummaryData; invoiceHref?: string; showDownloads?: boolean }) {
  const paid = order.status === "PAID" || order.status === "PARTIALLY_REFUNDED";
  return (
    <div className="space-y-6">
      <div className="card-soft p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Commande</p>
            <p className="font-heading text-2xl font-bold">{order.number}</p>
            <p className="text-sm text-ink-soft">{formatDateTime(order.paidAt ?? order.createdAt)} · {order.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={order.status} />
            {paid && invoiceHref && <Button asChild variant="outline" size="sm"><Link href={invoiceHref}><Receipt className="size-4" /> Facture</Link></Button>}
          </div>
        </div>
        <ul className="mt-5 divide-y divide-line">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span><span className="font-semibold">{it.name}</span>{it.quantity > 1 && <span className="text-ink-muted"> × {it.quantity}</span>}{it.bundleId && <span className="ml-2 rounded-full bg-lavender-light px-2 py-0.5 text-xs font-bold text-lavender-dark">Pack</span>}</span>
              <span className="font-bold">{formatPrice(it.totalCents, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          {order.discountCents > 0 && <div className="flex justify-between text-sage-dark"><dt>Remise{order.couponCode ? ` (${order.couponCode})` : ""}</dt><dd>-{formatPrice(order.discountCents, order.currency)}</dd></div>}
          <div className="flex justify-between text-ink-soft"><dt>dont TVA</dt><dd>{formatPrice(order.taxCents, order.currency)}</dd></div>
          <div className="flex justify-between font-heading text-lg font-bold"><dt>Total payé</dt><dd>{formatPrice(order.totalCents, order.currency)}</dd></div>
          {order.refundedCents > 0 && <div className="flex justify-between text-lavender-dark"><dt>Remboursé</dt><dd>{formatPrice(order.refundedCents, order.currency)}</dd></div>}
        </dl>
      </div>

      <OrderStatusNotice status={order.status} />

      {showDownloads && paid && (
        <section aria-labelledby="dl-title">
          <h2 id="dl-title" className="mb-3 font-heading text-2xl font-bold">Vos fichiers</h2>
          {order.entitlements.length === 0 ? (
            <Alert variant="info">Les fichiers sont en cours de préparation. Rafraîchissez la page dans quelques instants.</Alert>
          ) : (
            <ul className="space-y-4">
              {order.entitlements.map((ent) => {
                const revoked = Boolean(ent.revokedAt);
                const expired = ent.expiresAt ? ent.expiresAt < new Date() : false;
                const quota = ent.downloadCount >= ent.maxDownloads;
                const blocked = revoked || expired || quota;
                return (
                  <li key={ent.id} className="card-soft p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-heading text-lg font-bold"><Link href={`/aventures/${ent.product.slug}`} className="hover:underline">{ent.product.name}</Link></h3>
                      <span className="text-xs text-ink-muted">{ent.downloadCount}/{ent.maxDownloads} téléchargements</span>
                    </div>
                    {blocked && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-honey-light px-3 py-2 text-sm font-semibold text-honey-dark">
                        <AlertTriangle className="size-4" />
                        {revoked ? "Accès révoqué (commande remboursée)." : expired ? "Lien expiré : demandez un nouveau lien depuis « Retrouver mes achats »." : "Quota de téléchargements atteint : contactez le support."}
                      </p>
                    )}
                    {ent.product.files.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-soft">Les fichiers de ce kit sont en cours de finalisation. Vous recevrez automatiquement un email avec votre lien de téléchargement dès qu'ils seront prêts : rien à repayer.</p>
                    ) : (
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {ent.product.files.map((f) => (
                          <li key={f.id}>
                            {blocked ? (
                              <span className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink-muted"><FileText className="size-5" />{f.name}</span>
                            ) : (
                              <a href={downloadUrl(ent.token, f.id)} className="group flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-sm transition-colors hover:bg-coral-light" rel="nofollow">
                                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-coral-dark shadow-card"><Download className="size-5" /></span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-bold">{f.name}</span>
                                  <span className="block text-xs text-ink-muted">{FILE_KIND_LABEL[f.kind] ?? f.kind}{f.sizeBytes ? ` · ${formatBytes(f.sizeBytes)}` : ""}</span>
                                </span>
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link href="/boutique"><ShoppingBag className="size-4" /> Découvrir d&apos;autres aventures</Link></Button>
        <Button asChild variant="ghost"><Link href="/mes-achats">Retrouver mes achats</Link></Button>
      </div>
    </div>
  );
}
