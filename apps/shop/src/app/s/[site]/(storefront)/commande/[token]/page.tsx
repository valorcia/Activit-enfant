import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyOrderAccessToken } from "@/lib/orders/access";
import { OrderSummary, orderSummaryInclude } from "@/components/storefront/order-summary";

export const metadata: Metadata = { title: "Ma commande", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderAccessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const orderId = verifyOrderAccessToken(token);
  if (!orderId) notFound();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderSummaryInclude });
  if (!order) notFound();
  return (
    <div className="container-shell max-w-3xl py-10 sm:py-14">
      <h1 className="mb-6 font-heading text-3xl font-bold sm:text-4xl">Ma commande</h1>
      <OrderSummary order={order} invoiceHref={`/commande/${token}/facture`} />
    </div>
  );
}
