import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { brandFromParams, orderTrackToken } from "@/lib/unwritten/brand";
import { getDictionary } from "@/lib/unwritten/i18n";
import { href } from "@/lib/unwritten/i18n/routing";
import { PRIVATE_ROBOTS } from "@/lib/unwritten/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ session_id?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await brandFromParams(params);
  return { title: getDictionary(locale).order.confirmationTitle, robots: PRIVATE_ROBOTS, referrer: "no-referrer" };
}

/**
 * Retour de Stripe. La commande n'est confirmée QUE par le webhook : tant qu'elle n'est pas payée,
 * la page se recharge d'elle-même. Aucune donnée personnelle affichée ici.
 */
export default async function ConfirmationPage({ params, searchParams }: Props) {
  const { site, locale } = await brandFromParams(params);
  const { session_id } = await searchParams;
  const dict = getDictionary(locale).order;
  const order = session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id)
    ? await prisma.order.findFirst({ where: { stripeCheckoutSessionId: session_id, siteId: site.id }, select: { id: true, status: true, number: true } })
    : null;
  const paid = order && ["PAID", "PARTIALLY_REFUNDED"].includes(order.status);
  return (
    <section className="uw-section">
      {!paid && order && <meta httpEquiv="refresh" content="4" />}
      <div className="uw-narrow text-center">
        <span className="uw-rule mx-auto" />
        <h1 className="uw-h1 mt-10">{paid ? dict.confirmationTitle : dict.trackTitle}</h1>
        <p className="uw-lead mx-auto mt-6">{paid ? dict.confirmationLead : order ? dict.pending : dict.invalid}</p>
        {paid && (
          <div className="mt-10 flex justify-center">
            <Link href={href(locale, "order", orderTrackToken(order.id))} className="uw-btn">{dict.trackTitle} <span aria-hidden className="uw-arrow">→</span></Link>
          </div>
        )}
        {order && <p className="uw-small mt-8">{dict.number.replace("{number}", order.number)}</p>}
      </div>
    </section>
  );
}
