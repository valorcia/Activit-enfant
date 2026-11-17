import type { Metadata } from "next";
import { brandCurrency, brandFromParams } from "@/lib/unwritten/brand";
import { getUwProducts, lowestPrice } from "@/lib/unwritten/catalog";
import { fill, formatMoney, getDictionary } from "@/lib/unwritten/i18n";
import { localizedAlternates } from "@/lib/unwritten/seo";
import { BookCover } from "@/components/unwritten/cover";
import { Arrow, CollectionCard, Faq, SectionHead } from "@/components/unwritten/sections";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site, locale } = await brandFromParams(params);
  const dict = getDictionary(locale);
  return { title: { absolute: dict.meta.homeTitle }, description: dict.meta.homeDescription, alternates: localizedAlternates(site, locale) };
}

export default async function UnwrittenHome({ params }: Params) {
  const { site, locale } = await brandFromParams(params);
  const dict = getDictionary(locale);
  const h = dict.home;
  const products = await getUwProducts(site.id, locale, brandCurrency(site));
  const from = lowestPrice(products);
  const [first, second, third] = products;

  return (
    <>
      {/* Hero éditorial */}
      <section className="overflow-hidden">
        <div className="uw-container grid items-center gap-14 pb-20 pt-14 md:pt-20 lg:min-h-[calc(100dvh-110px)] lg:grid-cols-[1.08fr_1fr] lg:gap-10 lg:pb-24 lg:pt-10">
          <div className="uw-fade">
            <p className="uw-eyebrow">{h.hero.eyebrow}</p>
            <h1 className="uw-display mt-7 lg:max-w-[12.5ch]">{h.hero.title}</h1>
            <span className="uw-rule mt-9" />
            <p className="uw-lead mt-8">{h.hero.lead}</p>
            <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              <a href="#collections" className="uw-btn">{h.hero.cta} <Arrow /></a>
              <a href="#how" className="uw-textlink self-start sm:self-auto">{h.hero.secondary}</a>
            </div>
            <p className="uw-small mt-10">
              {h.hero.note}
              {from != null && <> · {fill(dict.common.from, { price: formatMoney(from, brandCurrency(site), locale) })}</>}
            </p>
          </div>
          {first && (
            /* Trois couvertures en quinconce, sans chevauchement (aucun titre masqué) */
            <div className="uw-fade uw-fade-2 mx-auto w-full max-w-[520px] lg:max-w-[660px]" aria-hidden>
              <div className="grid grid-cols-[1fr_1.22fr_1fr] items-center gap-[4%] py-[6%]">
                <div className="-translate-y-[9%]">{second && <BookCover collectionKey={second.collectionKey} title={second.name} locale={locale} />}</div>
                <div><BookCover collectionKey={first.collectionKey} title={first.name} locale={locale} priority /></div>
                <div className="translate-y-[11%]">{third && <BookCover collectionKey={third.collectionKey} title={third.name} locale={locale} />}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Collections */}
      <section id="collections" className="uw-section uw-surface scroll-mt-16">
        <div className="uw-container">
          <SectionHead eyebrow={h.collections.eyebrow} title={h.collections.title} lead={h.collections.lead} />
          <div className="mt-16 grid gap-16 md:grid-cols-3 md:gap-8 lg:gap-12">
            {products.map((p) => <CollectionCard key={p.id} product={p} locale={locale} dict={dict} />)}
          </div>
        </div>
      </section>

      {/* Démonstration du principe (exemple illustratif, personnages fictifs) */}
      <section className="uw-section">
        <div className="uw-container">
          <SectionHead eyebrow={h.principle.eyebrow} title={h.principle.title} lead={h.principle.lead} />
          <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_auto_1.15fr] lg:items-center lg:gap-14">
            <div>
              <p className="uw-badge">{h.principle.label}</p>
              <p className="uw-eyebrow mt-8">{h.principle.answersTitle}</p>
              <dl className="mt-5 divide-y divide-[var(--uw-line)] border-y border-[var(--uw-line)]">
                {h.principle.answers.map((a) => (
                  <div key={a.q} className="py-5">
                    <dt className="text-[0.8125rem] text-[var(--uw-muted)]">{a.q}</dt>
                    <dd className="uw-serif uw-italic mt-1.5 text-[1.45rem] leading-snug">{a.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div aria-hidden className="hidden text-2xl text-[var(--uw-stone)] lg:block">→</div>
            <figure>
              <p className="uw-eyebrow">{h.principle.pageTitle}</p>
              <div className="uw-page mt-5 aspect-[148/210] w-full max-w-[460px] px-[11%] py-[13%] sm:mx-0">
                <div className="flex h-full flex-col">
                  <p className="text-center text-[0.65rem] uppercase tracking-[0.3em] text-[var(--uw-muted)]">{h.principle.page.chapter}</p>
                  <p className="uw-serif mt-4 text-center text-[clamp(1.6rem,4.4vw,2.2rem)] leading-tight">{h.principle.page.heading}</p>
                  <span className="uw-rule mx-auto mt-5" />
                  <div className="uw-serif mt-7 space-y-3.5 text-[clamp(0.98rem,2.5vw,1.16rem)] leading-[1.58]">
                    {h.principle.page.body.map((p, i) => <p key={i} className={i === 0 ? "uw-dropcap" : ""}>{p}</p>)}
                  </div>
                  <p className="uw-serif mt-auto text-center text-sm text-[var(--uw-muted)]">— 23 —</p>
                </div>
              </div>
              <figcaption className="uw-small mt-5 max-w-[460px]">{h.principle.disclaimer}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Fonctionnement */}
      <section id="how" className="uw-section uw-dark scroll-mt-16">
        <div className="uw-container">
          <SectionHead eyebrow={h.how.eyebrow} title={h.how.title} />
          <ol className="mt-16 grid gap-px bg-[rgb(247_244_238/.12)] sm:grid-cols-2 lg:grid-cols-4">
            {h.how.steps.map((s, i) => (
              <li key={s.title} className="bg-[var(--uw-ink)] py-8 sm:p-8 lg:py-2 lg:pl-0 lg:pr-10 [&:not(:first-child)]:lg:pl-10">
                <p className="uw-serif text-[var(--uw-champagne)] text-3xl">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="uw-h3 mt-6 !text-[1.6rem]">{s.title}</h3>
                <p className="uw-body mt-4 !text-[0.925rem]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Extraits : emplacements réservés, jamais de faux contenu client */}
      <section className="uw-section">
        <div className="uw-container grid gap-14 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <SectionHead eyebrow={h.excerpts.eyebrow} title={h.excerpts.title} lead={h.excerpts.lead} />
          <div className="grid grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
            {products.map((p) => (
              <figure key={p.id}>
                <div className="uw-page flex aspect-[148/210] flex-col px-[12%] py-[14%]" aria-hidden>
                  <span className="uw-rule mx-auto !w-6 sm:!w-10" />
                  {/* Lignes de texte abstraites : la page est réservée, aucun contenu inventé */}
                  <div className="mt-[18%] space-y-[7%]">
                    {[100, 92, 97, 88, 95, 60].map((w, i) => <span key={i} className="block h-px bg-[var(--uw-line)]" style={{ width: `${w}%` }} />)}
                  </div>
                  <div className="mt-[14%] space-y-[7%]">
                    {[96, 90, 72].map((w, i) => <span key={i} className="block h-px bg-[var(--uw-line)]" style={{ width: `${w}%` }} />)}
                  </div>
                </div>
                <figcaption className="mt-4 sm:mt-5">
                  <span className="uw-serif uw-italic block text-[1rem] leading-tight sm:text-[1.3rem]">{p.name}</span>
                  <span className="uw-eyebrow mt-1.5 block !text-[0.58rem] sm:!text-[0.62rem]">{h.excerpts.slot}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Formats */}
      <section className="uw-section uw-surface">
        <div className="uw-container grid gap-14 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <SectionHead eyebrow={h.formats.eyebrow} title={h.formats.title} />
          <dl className="grid gap-x-12 sm:grid-cols-2">
            {h.formats.items.map((f) => (
              <div key={f.title} className="border-t border-[var(--uw-line)] py-7">
                <dt className="uw-serif text-[1.45rem] leading-snug">{f.title}</dt>
                <dd className="uw-body mt-3">{f.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="uw-section scroll-mt-16">
        <div className="uw-container grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <SectionHead eyebrow={h.faq.eyebrow} title={h.faq.title} />
          <Faq items={h.faq.items} />
        </div>
      </section>

      {/* Appel final */}
      <section className="uw-section uw-surface">
        <div className="uw-narrow text-center">
          <span className="uw-rule mx-auto" />
          <h2 className="uw-h2 mt-10">{h.final.title}</h2>
          <p className="uw-lead mx-auto mt-6">{h.final.lead}</p>
          <div className="mt-10 flex justify-center">
            <a href="#collections" className="uw-btn">{h.final.cta} <Arrow /></a>
          </div>
        </div>
      </section>
    </>
  );
}
