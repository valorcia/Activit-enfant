import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/misc";
import { OrderSummary, orderSummaryInclude } from "@/components/storefront/order-summary";
import { orderAccessUrl } from "@/lib/orders/access";
import { ShoppingBag } from "lucide-react";

export const metadata: Metadata = { title: "Mes achats", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MesAchatsTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.accessLink.findUnique({ where: { token }, include: { customer: true } });
  const now = new Date();
  if (!link || link.expiresAt < now) {
    return (
      <div className="container-shell max-w-xl py-16">
        <Alert variant="warning" title="Lien invalide ou expiré">Ce lien d&apos;accès n&apos;est plus valable. Demandez-en un nouveau : il vous sera envoyé par email en quelques secondes.</Alert>
        <Button asChild className="mt-6"><Link href="/mes-achats">Demander un nouveau lien</Link></Button>
      </div>
    );
  }
  if (!link.usedAt) await prisma.accessLink.update({ where: { id: link.id }, data: { usedAt: now } });
  const orders = await prisma.order.findMany({
    where: { customerId: link.customerId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    orderBy: { paidAt: "desc" },
    include: orderSummaryInclude,
  });

  return (
    <div className="container-shell max-w-3xl py-10 sm:py-14">
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">Mes achats</h1>
      <p className="mt-2 text-ink-soft">{link.customer.email} · lien valable jusqu&apos;au {link.expiresAt.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
      {orders.length === 0 ? (
        <EmptyState className="mt-8" icon={<ShoppingBag />} title="Aucune commande payée" description="Nous n'avons trouvé aucune commande confirmée pour cette adresse." action={<Button asChild><Link href="/boutique">Découvrir la boutique</Link></Button>} />
      ) : (
        <div className="mt-8 space-y-10">
          {orders.map((o) => (
            <section key={o.id} aria-label={`Commande ${o.number}`}>
              <OrderSummary order={o} invoiceHref={`${new URL(orderAccessUrl(o.id)).pathname}/facture`} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
