import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandCurrency, brandFromParams } from "@/lib/unwritten/brand";
import { getUwProduct } from "@/lib/unwritten/catalog";
import { browserDraft, questionnaireView } from "@/lib/unwritten/draft-view";
import { formatMoney, getDictionary } from "@/lib/unwritten/i18n";
import { href } from "@/lib/unwritten/i18n/routing";
import { audienceForMode } from "@/lib/unwritten/questionnaire/engine";
import { PRIVATE_ROBOTS } from "@/lib/unwritten/seo";
import type { DraftMode } from "@/lib/unwritten/constants";
import { bookPlan } from "@/lib/unwritten/book-plan";
import { COLLECTION_KEYS, type CollectionKey } from "@/lib/unwritten/constants";
import { allQuestions } from "@/lib/unwritten/questionnaire/schema";
import { BookCover } from "@/components/unwritten/cover";
import { BookPlanView } from "@/components/unwritten/book-plan";
import { QuestionnaireForm } from "@/components/unwritten/questionnaire-form";
import { DeleteDraft, SaveLater } from "@/components/unwritten/draft-tools";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await brandFromParams(params);
  return { title: getDictionary(locale).questionnaire.title, robots: PRIVATE_ROBOTS };
}

/** Questionnaire dynamique : une étape à la fois, sauvegardée à chaque « Continuer ». */
export default async function CreatePage({ params, searchParams }: Props) {
  const { site, locale } = await brandFromParams(params);
  const { slug } = await params;
  const sp = await searchParams;
  const dict = getDictionary(locale);
  const q = dict.questionnaire;
  const product = await getUwProduct(site.id, slug, locale, brandCurrency(site));
  if (!product) notFound();
  const found = await browserDraft(product.id);
  const draft = found?.draft ?? null;
  const view = await questionnaireView(product.id, draft, sp.mode);
  const key = (COLLECTION_KEYS as readonly string[]).includes(product.collectionKey) ? (product.collectionKey as CollectionKey) : null;
  const plan = key && view ? bookPlan(key, { locale, answers: view.answers, knownQuestions: allQuestions(view.definition).map((x) => x.id) }) : null;

  const aside = (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="flex items-center gap-5 lg:block">
        <div className="w-20 shrink-0 lg:w-40"><BookCover collectionKey={product.collectionKey} title={product.name} locale={locale} /></div>
        <div className="lg:mt-6">
          <p className="uw-serif text-[1.4rem] leading-tight">{product.name}</p>
          {product.priceCents != null && <p className="uw-small mt-1">{formatMoney(product.priceCents, product.currency, locale)}</p>}
        </div>
      </div>
      {plan && (
        <div className="mt-10 border-t border-[var(--uw-line)] pt-8">
          <p className="uw-eyebrow">{dict.plan.building}</p>
          <p className="uw-small mt-2 !leading-relaxed">{dict.plan.buildingLead}</p>
          <div className="mt-5"><BookPlanView plan={plan} dict={dict.plan} variant="live" /></div>
        </div>
      )}
      {draft && found?.state === "editable" && (
        <div className="mt-10 space-y-8 border-t border-[var(--uw-line)] pt-8">
          <SaveLater locale={locale} draftId={draft.id} labels={q.saveLater} busy={q.saving} defaultEmail={draft.email} />
          <DeleteDraft locale={locale} draftId={draft.id} productSlug={product.slug} label={q.deleteDraft} confirm={q.deleteConfirm} />
        </div>
      )}
    </aside>
  );

  let content: React.ReactNode;
  if (!view) {
    content = <p className="uw-lead">{q.unavailable}</p>;
  } else if (found?.state === "checkout") {
    content = (
      <div>
        <h1 className="uw-h2">{dict.review.title}</h1>
        <p className="uw-lead mt-6">{q.locked}</p>
      </div>
    );
  } else {
    const stepId = sp.step && view.steps.includes(sp.step) && (draft || sp.step === "mode") ? sp.step : draft ? view.steps[Math.min(draft.currentStep + 1, view.steps.length - 1)] : "mode";
    const index = view.steps.indexOf(stepId);
    const edition = view.definition.steps[0]?.questions.find((x) => x.type === "single" && x.audience === "buyer");
    const prefill = !draft && sp.edition && edition?.options?.some((o) => o.value === sp.edition) ? { q: edition.id, v: sp.edition } : null;
    content = (
      <>
        {sp.e === "locked" && <p role="alert" className="uw-error mb-8">{q.locked}</p>}
        <QuestionnaireForm
          variant="draft"
          locale={locale}
          productSlug={product.slug}
          definition={view.definition}
          stepId={stepId}
          stepNumber={index + 1}
          totalSteps={view.steps.length}
          answers={view.answers}
          audience={audienceForMode(view.mode)}
          mode={view.mode as DraftMode}
          gift={{ recipientName: draft?.giftRecipientName ?? null, recipientEmail: draft?.giftRecipientEmail ?? null, message: draft?.giftMessage ?? null }}
          consentGiven={!!draft?.sensitiveConsentAt}
          backHref={index > 0 ? `${href(locale, "create", product.slug)}?step=${view.steps[index - 1]}` : null}
          isLast={index === view.steps.length - 1}
          labels={q}
          common={{ optional: dict.common.optional }}
          prefill={prefill}
        />
      </>
    );
  }

  return (
    <section className="uw-section !pt-10 md:!pt-16">
      <div className="uw-container">
        <Link href={href(locale, "books", product.slug)} className="text-sm text-[var(--uw-muted)] hover:text-[var(--uw-ink)]">← {product.name}</Link>
        <div className="mt-8 grid gap-12 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-20">
          <div className="max-w-[640px] lg:order-1">{content}</div>
          <div className="lg:order-2">{aside}</div>
        </div>
      </div>
    </section>
  );
}
