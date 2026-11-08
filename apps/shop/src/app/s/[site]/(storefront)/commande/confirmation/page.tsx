import type { Metadata } from "next";
import Link from "next/link";
import { Hourglass, PartyPopper } from "lucide-react";
import { prisma } from "@/lib/db";
import { orderAccessUrl } from "@/lib/orders/access";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { OrderSummary, orderSummaryInclude } from "@/components/storefront/order-summary";
import { OrderConfirmationClient } from "@/components/storefront/order-confirmation-client";
import { PostPurchase } from "@/components/storefront/post-purchase";

export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const order = session_id ? await prisma.order.findUnique({ where: { stripeCheckoutSessionId: session_id }, include: orderSummaryInclude }) : null;

  if (!order) {
    return (
      <div className="container-shell max-w-2xl py-16 text-center">
        <h1 className="font-heading text-3xl font-bold">Commande introuvable</h1>
        <p className="mt-3 text-ink-soft">Nous n&apos;avons pas retrouvé cette commande. Si vous avez payé, vérifiez votre boîte mail : un email de confirmation vous a été envoyé.</p>
        <div className="mt-6 flex justify-center gap-3"><Button asChild><Link href="/mes-achats">Retrouver mes achats</Link></Button><Button asChild variant="outline"><Link href="/boutique">Boutique</Link></Button></div>
      </div>
    );
  }

  const paid = order.status === "PAID" || order.status === "PARTIALLY_REFUNDED";
  const accessUrl = orderAccessUrl(order.id);
  const accessPath = new URL(accessUrl).pathname;

  return (
    <div className="container-shell max-w-3xl py-10 sm:py-14">
      <OrderConfirmationClient status={order.status} orderId={order.id} totalCents={order.totalCents} currency={order.currency} items={order.items.map((i) => ({ id: i.productId ?? i.bundleId ?? i.id, name: i.name, price: i.unitPriceCents, quantity: i.quantity }))} />
      <div className="mb-8 text-center">
        <span className={`mx-auto grid size-20 place-items-center rounded-full ${paid ? "bg-sage-light text-sage-dark" : "bg-honey-light text-honey-dark"} shadow-card`}>
          {paid ? <PartyPopper className="size-10" /> : <Hourglass className="size-10 animate-wiggle" />}
        </span>
        <h1 className="mt-5 font-heading text-3xl font-bold sm:text-4xl">{paid ? "Merci, votre aventure est prête !" : "Paiement en cours de confirmation…"}</h1>
        <p className="mt-3 text-ink-soft">
          {paid
            ? <>Un email de confirmation avec vos liens a été envoyé à <strong>{order.email}</strong>. Vous pouvez aussi télécharger vos fichiers ci-dessous.</>
            : "Nous attendons la confirmation de Stripe. Cette page se met à jour automatiquement ; vous recevrez un email dès que vos fichiers seront disponibles."}
        </p>
      </div>
      {paid && (
        <Alert variant="info" className="mb-6">Conservez ce lien pour retrouver vos fichiers à tout moment : <Link href={accessPath} className="font-bold underline">page de ma commande</Link>. Vous pourrez aussi recevoir un nouveau lien depuis « Retrouver mes achats ».</Alert>
      )}
      <OrderSummary order={order} invoiceHref={paid ? `${accessPath}/facture` : undefined} />
      {paid && <PostPurchase siteId={order.siteId} purchasedProductIds={order.entitlements.map((e) => e.productId)} email={order.email} />}
    </div>
  );
}
