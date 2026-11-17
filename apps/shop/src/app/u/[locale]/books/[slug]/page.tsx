import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteUrl } from "@/lib/sites";
import { brandCurrency, brandFromParams } from "@/lib/unwritten/brand";
import { getUwProduct, getUwProducts } from "@/lib/unwritten/catalog";
import { fill, formatMoney, getDictionary } from "@/lib/unwritten/i18n";
import { href } from "@/lib/unwritten/i18n/routing";
import { localizedAlternates } from "@/lib/unwritten/seo";
import { BookCover } from "@/components/unwritten/cover";
import { Arrow, CollectionCard, Facts, Faq, pagesLabel } from "@/components/unwritten/sections";

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site, locale } = await brandFromParams(params);
  const { slug } = await params;
  const p = await getUwProduct(site.id, slug, locale, brandCurrency(site));
  if (!p) return {};
  return {
    title: p.content.seoTitle ? { absolute: p.content.seoTitle } : p.name,
    description: p.content.seoDescription ?? p.content.description,
    alternates: localizedAlternates(site, locale, "books", slug),
    openGraph: { title: p.content.seoTitle ?? p.name, description: p.content.seoDescription ?? p.content.description, type: "website" },
  };
}

export default async function BookPage({ params }: Params) {
  const { site, locale } = await brandFromParams(params);
  const { slug } = await params;
  const currency = brandCurrency(site);
  const product = await getUwProduct(site.id, slug, locale, currency);
  if (!product) notFound();
  const dict = getDictionary(locale);
  const d = dict.product;
  const c = product.content;
  const others = (await getUwProducts(site.id, locale, currency)).filter((p) => p.id !== product.id);
  const price = product.priceCents != null ? formatMoney(product.priceCents, currency, locale) : null;
  const create = href(locale, "create", product.slug);
  const faq = [...c.faq.map((f) => ({ q: f.q, a: f.a })), ...dict.home.faq.items.slice(0, 3)];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: c.description,
    brand: { "@type": "Brand", name: "UNWRITTEN" },
    ...(product.priceCents != null ? { offers: { "@type": "Offer", price: (product.priceCents / 100).toFixed(2), priceCurrency: currency, availability: "https://schema.org/InStock", url: `${siteUrl(site)}${href(locale, "books", product.slug)}` } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section>
        <div className="uw-container grid gap-12 py-12 md:py-16 lg:grid-cols-[1fr_1fr] lg:gap-20 lg:py-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="bg-[#EFEBE3] px-[16%] py-9 lg:py-[13%]">
              <div className="mx-auto max-w-[230px] lg:max-w-none"><BookCover collectionKey={product.collectionKey} title={product.name} locale={locale} priority /></div>
            </div>
            <div className="mt-4 hidden border border-dashed border-[var(--uw-line-strong)] px-5 py-4 lg:block">
              <p className="uw-eyebrow !text-[0.62rem]">{d.preview.title}</p>
              <p className="uw-small mt-1">{d.preview.text}</p>
            </div>
          </div>

          <div className="uw-fade">
            <p className="uw-eyebrow">{d.eyebrow}</p>
            <h1 className="uw-h1 mt-6">{product.name}</h1>
            <p className="uw-lead mt-6">{c.tagline}</p>
            {price && <p className="uw-serif mt-8 text-[2rem]">{price}</p>}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={create} className="uw-btn">{d.begin} <Arrow /></Link>
              <Link href={`${create}?mode=gift_recipient`} className="uw-btn uw-btn--ghost">{d.gift}</Link>
            </div>
            <p className="uw-small mt-4">{d.giftNote}</p>

            <div className="mt-12">
              <Facts rows={[
                { label: d.facts.format, value: d.formatValue },
                ...(pagesLabel(dict, product) ? [{ label: d.facts.pages, value: pagesLabel(dict, product)! }] : []),
                { label: d.facts.language, value: d.languageValue },
                { label: d.facts.delay, value: fill(dict.common.days, { min: product.deliveryDaysMin, max: product.deliveryDaysMax }), note: d.delayNote },
                ...(price ? [{ label: d.facts.price, value: price }] : []),
              ]} />
            </div>

            <p className="uw-body mt-12 text-[1.02rem]">{c.description}</p>
            <div className="mt-8 border border-dashed border-[var(--uw-line-strong)] px-5 py-4 lg:hidden">
              <p className="uw-eyebrow !text-[0.62rem]">{d.preview.title}</p>
              <p className="uw-small mt-1">{d.preview.text}</p>
            </div>

            {c.editions.length > 0 && (
              <div className="mt-14">
                <h2 className="uw-eyebrow">{d.editionsTitle}</h2>
                <ul className="mt-5 divide-y divide-[var(--uw-line)] border-y border-[var(--uw-line)]">
                  {c.editions.map((e) => (
                    <li key={e.key}>
                      <Link href={`${create}?edition=${encodeURIComponent(e.key)}`} className="group flex items-baseline justify-between gap-6 py-5">
                        <span>
                          <span className="uw-serif block text-[1.4rem] leading-tight">{e.label}</span>
                          <span className="uw-small mt-1 block">{e.text}</span>
                        </span>
                        <span className="text-[var(--uw-muted)] group-hover:text-[var(--uw-ink)]"><Arrow /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {c.inside.length > 0 && (
              <div className="mt-14">
                <h2 className="uw-eyebrow">{d.insideTitle}</h2>
                <ul className="mt-5 space-y-3">
                  {c.inside.map((x) => <li key={x} className="flex gap-4 text-[0.975rem] leading-relaxed"><span aria-hidden className="mt-[0.7em] h-px w-4 shrink-0 bg-[var(--uw-champagne)]" />{x}</li>)}
                </ul>
              </div>
            )}

            <div className="mt-14">
              <h2 className="uw-eyebrow mb-2">{d.faqTitle}</h2>
              <Faq items={faq} />
            </div>

            <div className="mt-14 bg-[var(--uw-white)] p-7 sm:p-9">
              <h2 className="uw-eyebrow">{d.termsTitle}</h2>
              <ul className="mt-5 space-y-4">
                {d.terms.map((t) => <li key={t} className="uw-small !text-[0.875rem] !leading-relaxed">{t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="uw-section uw-surface">
          <div className="uw-container">
            <h2 className="uw-h2">{d.related}</h2>
            <div className="mt-14 grid gap-16 md:grid-cols-2 md:gap-10 lg:max-w-4xl">
              {others.map((p) => <CollectionCard key={p.id} product={p} locale={locale} dict={dict} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
