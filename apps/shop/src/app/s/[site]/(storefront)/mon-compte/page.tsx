import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShoppingBag, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { currentCustomer } from "@/lib/customers/session";
import { orderAccessUrl } from "@/lib/orders/access";
import { logoutCustomerAction } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { AccessRequestForm } from "@/components/storefront/access-request-form";
import { OrderSummary, orderSummaryInclude } from "@/components/storefront/order-summary";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Compte client sans mot de passe : commandes payées et téléchargements du client reconnu sur cet
 * appareil ; sinon, demande d'un lien de connexion par e-mail.
 */
export default async function MonComptePage() {
  const customer = await currentCustomer();

  if (!customer) {
    return (
      <div className="container-shell max-w-xl py-10 sm:py-16">
        <div className="card-soft p-6 sm:p-8">
          <span className="grid size-14 place-items-center rounded-2xl bg-sky-light text-sky-dark"><KeyRound className="size-7" /></span>
          <h1 className="mt-4 font-heading text-3xl font-bold">Mon compte</h1>
          <p className="mt-2 text-ink-soft">Pas de mot de passe : votre compte est créé automatiquement lors de votre premier achat. Indiquez l&apos;adresse e-mail utilisée pour votre commande et nous vous envoyons un lien de connexion. Vous resterez ensuite connecté sur cet appareil.</p>
          <div className="mt-6"><AccessRequestForm /></div>
        </div>
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    orderBy: { paidAt: "desc" },
    include: orderSummaryInclude,
  });

  return (
    <div className="container-shell max-w-3xl py-10 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-sage-light text-sage-dark"><UserRound className="size-7" /></span>
          <div>
            <h1 className="font-heading text-3xl font-bold sm:text-4xl">Mon compte</h1>
            <p className="mt-1 text-ink-soft">{customer.name ? `${customer.name} · ` : ""}{customer.email}</p>
          </div>
        </div>
        <form action={logoutCustomerAction}><Button type="submit" variant="outline" size="sm">Se déconnecter de cet appareil</Button></form>
      </div>
      <h2 className="mt-10 font-heading text-2xl font-bold">Mes achats</h2>
      {orders.length === 0 ? (
        <EmptyState className="mt-6" icon={<ShoppingBag />} title="Aucune commande payée" description="Vos commandes confirmées et leurs téléchargements apparaîtront ici." action={<Button asChild><Link href="/boutique">Découvrir la boutique</Link></Button>} />
      ) : (
        <div className="mt-6 space-y-10">
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
