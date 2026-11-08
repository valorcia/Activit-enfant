import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CartPage } from "@/components/storefront/cart-page";
import { siteFromParams } from "@/lib/sites";

export const metadata: Metadata = { title: "Mon panier", robots: { index: false, follow: true } };

export default async function PanierPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ annule?: string }> }) {
  const site = await siteFromParams(params);
  const [{ annule }, commerce] = await Promise.all([searchParams, getSetting("commerce", site)]);
  return (
    <div className="container-shell py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Panier" }]} className="mb-6" />
      <h1 className="mb-6 font-heading text-3xl font-bold sm:text-4xl">Mon panier</h1>
      <CartPage cancelled={annule === "1"} withdrawalNotice={commerce.withdrawalNotice} />
    </div>
  );
}
