import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { isStripeLiveMode } from "@/lib/stripe";
import { orderAccessUrl } from "@/lib/orders/access";
import { AdminPageHeader, AdminCard, StatusPill } from "@/components/admin/page-header";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { OrderActions, EntitlementRow } from "@/components/admin/ops-order-actions";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("orders:read");
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { slug: true } }, bundle: { select: { slug: true } } } },
      payments: true,
      refunds: { include: { createdBy: { select: { email: true } } }, orderBy: { createdAt: "desc" } },
      customer: true,
      entitlements: { include: { product: { select: { name: true, slug: true } }, downloads: { orderBy: { createdAt: "desc" }, take: 20, include: { file: { select: { name: true } } } } } },
    },
  });
  if (!order) notFound();
  const canRefund = roleCan(user.role, "orders:refund");
  const live = await isStripeLiveMode();
  const stripeBase = `https://dashboard.stripe.com${live ? "" : "/test"}`;
  const isPaid = order.status === "PAID" || order.status === "PARTIALLY_REFUNDED";
  const address = order.billingAddress as { line1?: string; line2?: string; postal_code?: string; city?: string; country?: string } | null;

  return (
    <div>
      <AdminPageHeader
        title={`Commande ${order.number}`}
        breadcrumbs={[{ label: "Commandes", href: "/admin/commandes" }, { label: order.number }]}
        description={`Créée le ${formatDateTime(order.createdAt)}${order.paidAt ? ` · payée le ${formatDateTime(order.paidAt)}` : ""}`}
        actions={<StatusPill status={order.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <AdminCard title="Articles">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2">
                      <span className="font-semibold">{it.name}</span>
                      <span className="ml-2 text-xs text-ink-muted">{it.bundleId ? "Pack" : "Produit"}</span>
                      {it.product && <Link href={`/aventures/${it.product.slug}`} className="ml-2 text-xs text-coral-dark hover:underline" target="_blank">voir</Link>}
                    </td>
                    <td className="py-2 text-right text-ink-soft">× {it.quantity}</td>
                    <td className="py-2 text-right font-bold">{formatPrice(it.totalCents, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr><td colSpan={2} className="pt-3 text-right text-ink-soft">Sous-total</td><td className="pt-3 text-right">{formatPrice(order.subtotalCents, order.currency)}</td></tr>
                {order.discountCents > 0 && <tr><td colSpan={2} className="text-right text-ink-soft">Remise {order.couponCode ? `(${order.couponCode})` : ""}</td><td className="text-right">− {formatPrice(order.discountCents, order.currency)}</td></tr>}
                <tr><td colSpan={2} className="text-right text-ink-soft">dont TVA</td><td className="text-right">{formatPrice(order.taxCents, order.currency)}</td></tr>
                <tr><td colSpan={2} className="text-right font-bold">Total TTC</td><td className="text-right font-heading text-lg font-bold">{formatPrice(order.totalCents, order.currency)}</td></tr>
                {order.refundedCents > 0 && <tr><td colSpan={2} className="text-right text-lavender-dark">Remboursé</td><td className="text-right text-lavender-dark">− {formatPrice(order.refundedCents, order.currency)}</td></tr>}
              </tfoot>
            </table>
          </AdminCard>

          <AdminCard title="Droits de téléchargement" description={isPaid ? "Un droit par produit livré. Les fichiers restent accessibles via le lien envoyé au client." : "Aucun droit tant que le paiement n'est pas confirmé par Stripe."}>
            {order.entitlements.length === 0 ? <p className="text-sm text-ink-muted">Aucun droit de téléchargement.</p> : (
              <ul className="divide-y divide-line">
                {order.entitlements.map((e) => <EntitlementRow key={e.id} entitlement={{ id: e.id, productName: e.product.name, downloadCount: e.downloadCount, maxDownloads: e.maxDownloads, revokedAt: e.revokedAt?.toISOString() ?? null, expiresAt: e.expiresAt?.toISOString() ?? null, lastDownloadedAt: e.lastDownloadedAt?.toISOString() ?? null, downloads: e.downloads.map((d) => ({ id: d.id, at: formatDateTime(d.createdAt), file: d.file?.name ?? "—", ip: d.ip ?? "" })) }} canManage={canRefund} />)}
              </ul>
            )}
          </AdminCard>

          {order.refunds.length > 0 && (
            <AdminCard title="Remboursements">
              <ul className="divide-y divide-line text-sm">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span>{formatDateTime(r.createdAt)} {r.reason ? `· ${r.reason}` : ""} {r.createdBy ? <span className="text-ink-muted">· {r.createdBy.email}</span> : null}</span>
                    <span className="font-bold">{formatPrice(r.amountCents, order.currency)}</span>
                  </li>
                ))}
              </ul>
            </AdminCard>
          )}
        </div>

        <div className="space-y-6">
          <AdminCard title="Client">
            <p className="font-semibold">{order.billingName ?? order.customer?.name ?? "—"}</p>
            <p className="text-sm">{order.email || "—"}</p>
            {address?.line1 && <p className="mt-2 text-sm text-ink-soft">{address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />{address.postal_code} {address.city} {address.country}</p>}
            {order.customer && <Link href={`/admin/clients/${order.customer.id}`} className="mt-3 inline-block text-sm font-bold text-coral-dark hover:underline">Fiche client →</Link>}
            {order.utm && Object.keys(order.utm as object).length > 0 && (
              <p className="mt-3 text-xs text-ink-muted">UTM : {Object.entries(order.utm as Record<string, string>).map(([k, v]) => `${k}=${v}`).join(", ")}</p>
            )}
          </AdminCard>

          <AdminCard title="Paiement">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-ink-soft">Mode</dt><dd>{live ? "Stripe (production)" : "Stripe (test)"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Facture</dt><dd>{order.invoiceNumber ?? "—"}</dd></div>
              {order.payments.map((p) => (
                <div key={p.id} className="flex justify-between"><dt className="text-ink-soft">{p.providerId.slice(0, 14)}…</dt><dd><StatusPill status={p.status === "SUCCEEDED" ? "PAID" : p.status} /></dd></div>
              ))}
            </dl>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {order.stripePaymentIntentId && <a href={`${stripeBase}/payments/${order.stripePaymentIntentId}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-bold text-coral-dark hover:underline"><ExternalLink className="size-3.5" /> Ouvrir dans Stripe</a>}
              {isPaid && <a href={`${orderAccessUrl(order.id)}/facture`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-bold text-coral-dark hover:underline"><ExternalLink className="size-3.5" /> Voir la facture</a>}
              {isPaid && <a href={orderAccessUrl(order.id)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-bold text-coral-dark hover:underline"><ExternalLink className="size-3.5" /> Page client de la commande</a>}
            </div>
          </AdminCard>

          <AdminCard title="Actions">
            <OrderActions orderId={order.id} isPaid={isPaid} canRefund={canRefund} remainingCents={order.totalCents - order.refundedCents} currency={order.currency} hasPaymentIntent={!!order.stripePaymentIntentId} />
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
