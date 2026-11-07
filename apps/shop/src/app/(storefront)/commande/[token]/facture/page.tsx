import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyOrderAccessToken } from "@/lib/orders/access";
import { getSetting } from "@/lib/settings";
import { formatDate, formatPrice } from "@/lib/utils";
import { PrintButton } from "@/components/storefront/print-button";

export const metadata: Metadata = { title: "Facture", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const orderId = verifyOrderAccessToken(token);
  if (!orderId) notFound();
  const [order, brand] = await Promise.all([prisma.order.findUnique({ where: { id: orderId }, include: { items: true, customer: true } }), getSetting("brand")]);
  if (!order || (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED" && order.status !== "REFUNDED")) notFound();
  const addr = (order.billingAddress ?? null) as null | { line1?: string; line2?: string; postal_code?: string; city?: string; country?: string };
  const ht = order.totalCents - order.taxCents;

  return (
    <div className="container-shell max-w-3xl py-8 print:max-w-none print:py-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <article className="rounded-3xl bg-white p-6 shadow-card sm:p-10 print:rounded-none print:p-0 print:shadow-none" aria-label={`Facture ${order.invoiceNumber ?? order.number}`}>
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="font-heading text-2xl font-bold">{brand.legalName ?? brand.name}</p>
            {brand.legalAddress && <p className="whitespace-pre-line text-sm text-ink-soft">{brand.legalAddress}</p>}
            {brand.vatNumber && <p className="text-sm text-ink-soft">TVA : {brand.vatNumber}</p>}
            {brand.contactEmail && <p className="text-sm text-ink-soft">{brand.contactEmail}</p>}
          </div>
          <div className="text-right">
            <h1 className="font-heading text-3xl font-bold">Facture</h1>
            <p className="mt-1 font-bold">{order.invoiceNumber ?? "—"}</p>
            <p className="text-sm text-ink-soft">Commande {order.number}</p>
            <p className="text-sm text-ink-soft">Date : {formatDate(order.paidAt ?? order.createdAt)}</p>
          </div>
        </header>
        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Facturé à</p>
            <p className="mt-1 font-semibold">{order.billingName ?? order.customer?.name ?? order.email}</p>
            <p className="text-sm text-ink-soft">{order.email}</p>
            {addr && (addr.line1 || addr.city) && (
              <p className="text-sm text-ink-soft">{[addr.line1, addr.line2].filter(Boolean).join(", ")}<br />{[addr.postal_code, addr.city].filter(Boolean).join(" ")}{addr.country ? `, ${addr.country}` : ""}</p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Paiement</p>
            <p className="mt-1 text-sm">Carte bancaire via Stripe</p>
            <p className="text-sm text-ink-soft">Réglée le {formatDate(order.paidAt)}</p>
            {order.refundedCents > 0 && <p className="text-sm font-bold text-lavender-dark">Remboursé : {formatPrice(order.refundedCents, order.currency)}</p>}
          </div>
        </section>
        <table className="w-full text-sm">
          <thead><tr className="border-b-2 border-ink/20 text-left text-xs uppercase tracking-wider text-ink-muted"><th className="py-2">Désignation</th><th className="py-2 text-right">Qté</th><th className="py-2 text-right">Prix unitaire TTC</th><th className="py-2 text-right">Total TTC</th></tr></thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-b border-line"><td className="py-3">{it.name}<span className="block text-xs text-ink-muted">Contenu numérique — TVA {(it.taxRateBp / 100).toFixed(it.taxRateBp % 100 ? 1 : 0)} %</span></td><td className="py-3 text-right">{it.quantity}</td><td className="py-3 text-right">{formatPrice(it.unitPriceCents, order.currency)}</td><td className="py-3 text-right font-semibold">{formatPrice(it.totalCents, order.currency)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Sous-total TTC</dt><dd>{formatPrice(order.subtotalCents, order.currency)}</dd></div>
          {order.discountCents > 0 && <div className="flex justify-between"><dt>Remise{order.couponCode ? ` (${order.couponCode})` : ""}</dt><dd>-{formatPrice(order.discountCents, order.currency)}</dd></div>}
          <div className="flex justify-between"><dt>Total HT</dt><dd>{formatPrice(ht, order.currency)}</dd></div>
          <div className="flex justify-between"><dt>TVA incluse</dt><dd>{formatPrice(order.taxCents, order.currency)}</dd></div>
          <div className="flex justify-between border-t border-ink/20 pt-2 font-heading text-lg font-bold"><dt>Total TTC</dt><dd>{formatPrice(order.totalCents, order.currency)}</dd></div>
        </dl>
        <footer className="mt-8 border-t border-line pt-4 text-xs text-ink-muted">
          <p>Prix TTC, TVA incluse. Contenu numérique fourni par téléchargement : conformément à l&apos;article L221-28 du Code de la consommation, le droit de rétractation ne s&apos;applique pas après le début du téléchargement avec l&apos;accord exprès du client.</p>
        </footer>
      </article>
    </div>
  );
}
