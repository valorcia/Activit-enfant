import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isStripeConfigured } from "@/lib/stripe";
import { brandCurrency, brandFromParams } from "@/lib/unwritten/brand";
import { getUwProduct } from "@/lib/unwritten/catalog";
import { browserDraft, displayAnswer } from "@/lib/unwritten/draft-view";
import { draftAnswers, draftDefinition, draftMissing } from "@/lib/unwritten/drafts";
import { fill, formatMoney, getDictionary } from "@/lib/unwritten/i18n";
import { href } from "@/lib/unwritten/i18n/routing";
import { audienceForMode, visibleSteps } from "@/lib/unwritten/questionnaire/engine";
import { PRIVATE_ROBOTS } from "@/lib/unwritten/seo";
import { bookPlan } from "@/lib/unwritten/book-plan";
import { COLLECTION_KEYS, type CollectionKey } from "@/lib/unwritten/constants";
import { allQuestions } from "@/lib/unwritten/questionnaire/schema";
import { photoEntries } from "@/lib/unwritten/questionnaire/engine";
import { BookCover } from "@/components/unwritten/cover";
import { BookPlanView } from "@/components/unwritten/book-plan";
import { CheckoutForm, DeleteDraft } from "@/components/unwritten/draft-tools";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await brandFromParams(params);
  return { title: getDictionary(locale).review.title, robots: PRIVATE_ROBOTS };
}

/** Récapitulatif des informations importantes, corrigeables avant le paiement. */
export default async function ReviewPage({ params }: Props) {
  const { site, locale } = await brandFromParams(params);
  const { slug } = await params;
  const dict = getDictionary(locale);
  const r = dict.review;
  const product = await getUwProduct(site.id, slug, locale, brandCurrency(site));
  if (!product) notFound();
  const found = await browserDraft(product.id);
  const create = href(locale, "create", product.slug);
  if (!found) redirect(create);
  const { draft, state } = found;
  const def = draftDefinition(draft);
  const answers = draftAnswers(draft);
  const audience = audienceForMode(draft.mode);
  const steps = visibleSteps(def, answers, audience);
  const missing = draftMissing(draft);
  const stripeReady = await isStripeConfigured();
  const price = product.priceCents != null ? formatMoney(product.priceCents, product.currency, locale) : null;
  const recipient = draft.giftRecipientName || null;
  const key = (COLLECTION_KEYS as readonly string[]).includes(product.collectionKey) ? (product.collectionKey as CollectionKey) : null;
  const plan = key ? bookPlan(key, { locale, answers, knownQuestions: allQuestions(def).map((x) => x.id) }) : null;
  const photoSrc = (id: string) => `/api/u/photos/${id}?product=${encodeURIComponent(product.slug)}`;

  return (
    <section className="uw-section !pt-10 md:!pt-16">
      <div className="uw-container">
        <Link href={`${create}?step=${steps[steps.length - 1]?.step.id ?? "mode"}`} className="text-sm text-[var(--uw-muted)] hover:text-[var(--uw-ink)]">← {dict.common.back}</Link>
        <div className="mt-8 grid gap-14 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-20">
          <div className="max-w-[680px]">
            <h1 className="uw-h1">{r.title}</h1>
            <p className="uw-lead mt-6">{r.lead}</p>

            {plan && (
              <div className="mt-12 border-t border-[var(--uw-line)] py-7">
                <p className="uw-eyebrow">{dict.plan.title}</p>
                <p className="uw-small mt-2">{dict.plan.reviewLead}</p>
                <div className="mt-6"><BookPlanView plan={plan} dict={dict.plan} variant="review" /></div>
              </div>
            )}

            <div className="border-t border-[var(--uw-line)] py-7">
              <div className="flex items-baseline justify-between gap-6">
                <p className="uw-eyebrow">{dict.questionnaire.modeTitle}</p>
                <Link href={`${create}?step=mode`} className="text-sm uw-underline">{r.edit}</Link>
              </div>
              <p className="uw-serif mt-3 text-[1.45rem]">{dict.questionnaire.modes[draft.mode as "self" | "gift" | "gift_recipient"]?.title ?? draft.mode}</p>
              {draft.mode !== "self" && recipient && <p className="uw-small mt-2">{fill(r.giftFor, { name: recipient })}</p>}
              {draft.mode === "gift_recipient" && <p className="uw-small mt-1">{r.giftRecipientFills}</p>}
            </div>

            {steps.map(({ step, questions }) => (
              <div key={step.id} className="border-t border-[var(--uw-line)] py-7">
                <div className="flex items-baseline justify-between gap-6">
                  <p className="uw-eyebrow">{step.title[locale]}</p>
                  <Link href={`${create}?step=${step.id}`} className="text-sm uw-underline">{r.edit}</Link>
                </div>
                <dl className="mt-4 space-y-5">
                  {questions.filter((q) => q.type !== "info").map((q) => {
                    if (q.type === "photos") {
                      const list = photoEntries(answers[q.id]);
                      return (
                        <div key={q.id}>
                          <dt className="text-[0.8125rem] text-[var(--uw-muted)]">{q.label[locale]}</dt>
                          <dd className="mt-2">
                            {list.length ? (
                              <ul className="flex flex-wrap gap-3">
                                {list.map((e) => (
                                  <li key={e.id} className="w-[104px]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={photoSrc(e.id)} alt={e.caption} className="aspect-square w-full bg-[#EFEBE3] object-cover" loading="lazy" />
                                    {e.caption && <p className="mt-1 line-clamp-2 text-[0.72rem] leading-snug text-[var(--uw-soft)]">{e.caption}</p>}
                                  </li>
                                ))}
                              </ul>
                            ) : <span className="text-[0.9rem] italic text-[var(--uw-muted)]">{r.empty}</span>}
                          </dd>
                        </div>
                      );
                    }
                    const v = displayAnswer(q, answers[q.id], locale);
                    const isMissing = missing.includes(q.id);
                    return (
                      <div key={q.id}>
                        <dt className="text-[0.8125rem] text-[var(--uw-muted)]">{q.label[locale]}</dt>
                        <dd className={`mt-1 whitespace-pre-line ${v ? "uw-serif text-[1.25rem] leading-snug" : "text-[0.9rem] text-[var(--uw-muted)] italic"} ${isMissing ? "!text-[#8a2e22]" : ""}`}>{v ?? r.empty}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
            <div className="border-t border-[var(--uw-line)] pt-7">
              <DeleteDraft locale={locale} draftId={draft.id} productSlug={product.slug} label={dict.questionnaire.deleteDraft} confirm={dict.questionnaire.deleteConfirm} />
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="uw-surface p-7 sm:p-9">
              <div className="flex items-center gap-5">
                <div className="w-16 shrink-0"><BookCover collectionKey={product.collectionKey} title={product.name} locale={locale} /></div>
                <p className="uw-serif text-[1.35rem] leading-tight">{product.name}</p>
              </div>
              <div className="mt-7 flex items-baseline justify-between border-y border-[var(--uw-line)] py-5">
                <span className="uw-eyebrow">{r.total}</span>
                <span className="text-right"><span className="uw-serif block text-[1.7rem] leading-none">{price ?? "—"}</span><span className="uw-small">{r.taxes}</span></span>
              </div>
              <div className="mt-7">
                {state === "checkout" ? (
                  <p className="uw-body">{dict.questionnaire.locked}</p>
                ) : missing.length ? (
                  <div>
                    <p role="alert" className="uw-error !mt-0">{r.missing}</p>
                    <Link href={create} className="uw-btn uw-btn--block mt-5">{dict.common.continue}</Link>
                  </div>
                ) : (
                  <>
                    <CheckoutForm locale={locale} draftId={draft.id} defaultEmail={draft.email} disabled={!stripeReady} labels={{ email: r.email, pay: fill(r.pay, { price: price ?? "" }), secure: r.secure, busy: dict.questionnaire.saving, notice: r.termsNotice }} />
                    {!stripeReady && <p className="uw-small mt-4">{r.notReady}</p>}
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
