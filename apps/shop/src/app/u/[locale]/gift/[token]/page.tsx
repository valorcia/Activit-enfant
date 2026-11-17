import type { Metadata } from "next";
import { brandFromParams } from "@/lib/unwritten/brand";
import { displayAnswer } from "@/lib/unwritten/draft-view";
import { fill, getDictionary } from "@/lib/unwritten/i18n";
import { href } from "@/lib/unwritten/i18n/routing";
import { combinedGiftAnswers, findGiftByToken, itemDefinition } from "@/lib/unwritten/orders";
import { missingAnswers, visibleSteps } from "@/lib/unwritten/questionnaire/engine";
import { PRIVATE_ROBOTS } from "@/lib/unwritten/seo";
import { BookCover } from "@/components/unwritten/cover";
import { QuestionnaireForm } from "@/components/unwritten/questionnaire-form";
import { GiftComplete } from "@/components/unwritten/draft-tools";

type Props = { params: Promise<{ locale: string; token: string }>; searchParams: Promise<{ step?: string; done?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await brandFromParams(params);
  return { title: getDictionary(locale).gift.title, robots: PRIVATE_ROBOTS, referrer: "no-referrer" };
}

/**
 * Cadeau : le destinataire complète lui-même ses informations (questions « subject » seulement),
 * sans compte. Lien privé, révocable (rotation), jamais indexé.
 */
export default async function GiftPage({ params, searchParams }: Props) {
  const { locale } = await brandFromParams(params);
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const sp = await searchParams;
  const dict = getDictionary(locale);
  const g = dict.gift;

  const shell = (children: React.ReactNode) => (
    <section className="uw-section !pt-12 md:!pt-20"><div className="uw-narrow">{children}</div></section>
  );
  if (sp.done) return shell(<div className="text-center"><span className="uw-rule mx-auto" /><h1 className="uw-h1 mt-10">{g.done}</h1></div>);

  const found = await findGiftByToken(token);
  if (!found.ok) return shell(<div className="text-center"><span className="uw-rule mx-auto" /><p role="alert" className="uw-lead mx-auto mt-10">{found.reason === "completed" ? g.already : g.invalid}</p></div>);
  const { claim } = found;
  const def = itemDefinition(claim.personalItem);
  if (!def) return shell(<p className="uw-lead">{dict.questionnaire.unavailable}</p>);
  const answers = combinedGiftAnswers(claim);
  const steps = visibleSteps(def, answers, "subject");
  const product = claim.personalItem.product;
  const from = claim.personalItem.order.billingName?.trim().split(/\s+/)[0] ?? null;
  const base = href(locale, "gift", token);

  if (!sp.step) {
    return shell(
      <div>
        <div className="mx-auto w-28"><BookCover collectionKey={product?.personalization?.collectionKey ?? "secret-book"} title={product?.name ?? "UNWRITTEN"} locale={locale} /></div>
        <h1 className="uw-h1 mt-12 text-center">{g.title}</h1>
        <p className="uw-lead mx-auto mt-6 text-center">{from ? fill(g.lead, { from }) : g.leadAnonymous}</p>
        {claim.message && (
          <figure className="mx-auto mt-10 max-w-lg border-l border-[var(--uw-champagne)] pl-6">
            <figcaption className="uw-eyebrow">{g.message}</figcaption>
            <blockquote className="uw-serif uw-italic mt-3 whitespace-pre-line text-[1.45rem] leading-snug">{claim.message}</blockquote>
          </figure>
        )}
        <div className="mt-12 flex justify-center">
          <a href={`${base}?step=${steps[0]?.step.id ?? "review"}`} className="uw-btn">{g.start} <span aria-hidden className="uw-arrow">→</span></a>
        </div>
      </div>,
    );
  }

  if (sp.step === "review" || !steps.some((s) => s.step.id === sp.step)) {
    const missing = missingAnswers(def, answers, { consent: !!claim.sensitiveConsentAt, audience: "subject" });
    return shell(
      <div>
        <h1 className="uw-h1">{dict.review.title}</h1>
        <p className="uw-lead mt-6">{dict.review.lead}</p>
        <div className="mt-12">
          {steps.map(({ step, questions }) => (
            <div key={step.id} className="border-t border-[var(--uw-line)] py-7">
              <div className="flex items-baseline justify-between gap-6">
                <p className="uw-eyebrow">{step.title[locale]}</p>
                <a href={`${base}?step=${step.id}`} className="text-sm uw-underline">{dict.review.edit}</a>
              </div>
              <dl className="mt-4 space-y-5">
                {questions.filter((q) => q.type !== "info").map((q) => (
                  <div key={q.id}>
                    <dt className="text-[0.8125rem] text-[var(--uw-muted)]">{q.label[locale]}</dt>
                    <dd className="uw-serif mt-1 whitespace-pre-line text-[1.25rem] leading-snug">{displayAnswer(q, answers[q.id], locale) ?? <span className="text-[0.9rem] italic text-[var(--uw-muted)]">{dict.review.empty}</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-[var(--uw-line)] pt-8">
          {missing.length ? <p role="alert" className="uw-error">{dict.review.missing}</p> : <GiftComplete locale={locale} token={token} label={g.submit} busy={dict.questionnaire.saving} />}
        </div>
      </div>,
    );
  }

  const ids = steps.map((s) => s.step.id);
  const index = ids.indexOf(sp.step);
  return shell(
    <QuestionnaireForm
      variant="gift"
      locale={locale}
      productSlug={product?.slug ?? ""}
      token={token}
      definition={def}
      stepId={sp.step}
      stepNumber={index + 1}
      totalSteps={ids.length}
      answers={answers}
      audience="subject"
      mode="gift_recipient"
      gift={{ recipientName: null, recipientEmail: null, message: null }}
      consentGiven={!!claim.sensitiveConsentAt}
      backHref={index > 0 ? `${base}?step=${ids[index - 1]}` : base}
      isLast={index === ids.length - 1}
      labels={dict.questionnaire}
      common={{ optional: dict.common.optional }}
    />,
  );
}
