import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PersonalItemStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { downloadUrl, verifyOrderAccessToken } from "@/lib/orders/access";
import { brandFromParams, brandUrl } from "@/lib/unwritten/brand";
import { formatDate, getDictionary } from "@/lib/unwritten/i18n";
import { PRIVATE_ROBOTS } from "@/lib/unwritten/seo";
import { BookCover } from "@/components/unwritten/cover";
import { GiftLinkRotator } from "@/components/unwritten/draft-tools";
import { fromUrlToken } from "@/lib/unwritten/tokens";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await brandFromParams(params);
  return { title: getDictionary(locale).order.trackTitle, robots: PRIVATE_ROBOTS, referrer: "no-referrer" };
}

const STEPS: PersonalItemStatus[] = ["PENDING_GENERATION", "IN_PRODUCTION", "DELIVERED"];

/** Suivi privé « votre livre est en préparation » (lien signé, valable un an, jamais indexé). */
export default async function OrderTrackPage({ params }: Props) {
  const { site, locale } = await brandFromParams(params);
  const { token } = await params;
  const dict = getDictionary(locale).order;
  const orderId = verifyOrderAccessToken(fromUrlToken(token));
  if (!orderId) notFound();
  const order = await prisma.order.findFirst({
    where: { id: orderId, siteId: site.id },
    include: { personalItems: { include: { product: { select: { name: true, personalization: { select: { collectionKey: true } } } }, entitlement: true, gift: { select: { completedAt: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();
  const base = brandUrl(site, "/").replace(/\/\?.*$/, "").replace(/\/$/, "");

  return (
    <section className="uw-section !pt-12 md:!pt-20">
      <div className="uw-narrow">
        <p className="uw-eyebrow">{dict.number.replace("{number}", order.number)} · {formatDate(order.createdAt, locale)}</p>
        <h1 className="uw-h1 mt-6">{dict.trackTitle}</h1>
        <p className="uw-lead mt-6">{dict.trackLead}</p>

        <div className="mt-14 space-y-8">
          {order.personalItems.map((item) => {
            const reached = item.status === "AWAITING_RECIPIENT" ? -1 : STEPS.indexOf(item.status === "ERROR" ? "IN_PRODUCTION" : item.status);
            return (
              <article key={item.id} className="uw-surface p-7 sm:p-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 shrink-0 sm:w-20"><BookCover collectionKey={item.product?.personalization?.collectionKey ?? "secret-book"} title={item.product?.name ?? "UNWRITTEN"} locale={locale} /></div>
                  <div>
                    <h2 className="uw-serif text-[1.6rem] leading-tight">{item.product?.name ?? "UNWRITTEN"}</h2>
                    <p className="mt-2 text-[0.95rem]">{dict.status[item.status]}</p>
                  </div>
                </div>
                {item.status !== "CANCELLED" && (
                  <ol className="mt-9 grid grid-cols-3 gap-2" aria-label={dict.trackTitle}>
                    {STEPS.map((s, i) => (
                      <li key={s}>
                        <span className={`block h-px ${i <= reached ? "bg-[var(--uw-ink)]" : "bg-[var(--uw-line-strong)]"}`} />
                        <span className={`mt-3 block text-[0.72rem] leading-snug ${i <= reached ? "text-[var(--uw-ink)]" : "text-[var(--uw-muted)]"}`}>{dict.status[s]}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="uw-body mt-7">{dict.statusText[item.status]}</p>
                {item.status === "DELIVERED" && item.entitlement && !item.entitlement.revokedAt && (
                  <a href={downloadUrl(item.entitlement.token, item.id, base)} className="uw-btn mt-7">{dict.download} <span aria-hidden>↓</span></a>
                )}
                {item.status === "AWAITING_RECIPIENT" && !item.gift?.completedAt && (
                  <div className="mt-8 border-t border-[var(--uw-line)] pt-7">
                    <p className="uw-eyebrow">{dict.giftLinkTitle}</p>
                    <p className="uw-small mt-3">{dict.giftLinkText}</p>
                    <div className="mt-5"><GiftLinkRotator locale={locale} orderToken={fromUrlToken(token)} itemId={item.id} labels={{ cta: dict.giftLinkCta, busy: "…" }} /></div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
