import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandCurrency, brandFromParams } from "@/lib/unwritten/brand";
import { getUwCollection, getUwProducts } from "@/lib/unwritten/catalog";
import { fill, formatMoney, getDictionary } from "@/lib/unwritten/i18n";
import { href } from "@/lib/unwritten/i18n/routing";
import { localizedAlternates } from "@/lib/unwritten/seo";
import { BookCover } from "@/components/unwritten/cover";
import { Arrow, CollectionCard, Facts, pagesLabel } from "@/components/unwritten/sections";

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site, locale } = await brandFromParams(params);
  const { slug } = await params;
  const data = await getUwCollection(site.id, slug, locale, brandCurrency(site));
  if (!data) return {};
  const book = data.products[0];
  return { title: book.name, description: book.content.collectionLead, alternates: localizedAlternates(site, locale, "collections", slug) };
}

export default async function CollectionPage({ params }: Params) {
  const { site, locale } = await brandFromParams(params);
  const { slug } = await params;
  const currency = brandCurrency(site);
  const data = await getUwCollection(site.id, slug, locale, currency);
  if (!data) notFound();
  const dict = getDictionary(locale);
  const book = data.products[0];
  const c = book.content;
  const others = (await getUwProducts(site.id, locale, currency)).filter((p) => p.collectionSlug !== slug);

  return (
    <>
      <section>
        <div className="uw-container grid items-center gap-14 py-14 md:py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-24 lg:py-28">
          <div className="mx-auto w-full max-w-[400px] lg:order-2 lg:max-w-[440px]">
            <BookCover collectionKey={book.collectionKey} title={book.name} locale={locale} priority />
          </div>
          <div className="uw-fade lg:order-1">
            <p className="uw-eyebrow">{dict.collection.eyebrow}</p>
            <h1 className="uw-h1 mt-6">{book.name}</h1>
            <span className="uw-rule mt-8" />
            <p className="uw-lead mt-8">{c.collectionLead}</p>
            <div className="mt-6 space-y-4">
              {c.story.map((p, i) => <p key={i} className="uw-body max-w-xl">{p}</p>)}
            </div>
            <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              <Link href={href(locale, "create", book.slug)} className="uw-btn">{dict.collection.cta} <Arrow /></Link>
              <Link href={href(locale, "books", book.slug)} className="uw-textlink self-start sm:self-auto">{dict.collection.view}</Link>
            </div>
          </div>
        </div>
      </section>

      {c.editions.length > 0 && (
        <section className="uw-section uw-surface">
          <div className="uw-container">
            <div className="max-w-2xl">
              <p className="uw-eyebrow">{dict.collection.editionsTitle}</p>
              <h2 className="uw-h2 mt-5">{dict.collection.editionsLead}</h2>
            </div>
            <ul className="mt-14 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {c.editions.map((e) => (
                <li key={e.key} className="border-t border-[var(--uw-line)] py-7">
                  <Link href={`${href(locale, "create", book.slug)}?edition=${encodeURIComponent(e.key)}`} className="group block">
                    <p className="uw-serif text-[1.6rem] leading-tight">{e.label}</p>
                    <p className="uw-body mt-3">{e.text}</p>
                    <p className="mt-4 text-[var(--uw-muted)] transition-colors group-hover:text-[var(--uw-ink)]"><Arrow /></p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="uw-section">
        <div className="uw-container grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
          <div>
            <p className="uw-eyebrow">{dict.collection.bookTitle}</p>
            <h2 className="uw-h2 mt-5 !text-[clamp(1.8rem,3.2vw,2.4rem)]">{c.tagline}</h2>
          </div>
          <div>
            <Facts rows={[
              { label: dict.product.facts.format, value: dict.product.formatValue },
              ...(pagesLabel(dict, book) ? [{ label: dict.product.facts.pages, value: pagesLabel(dict, book)! }] : []),
              { label: dict.product.facts.delay, value: fill(dict.common.days, { min: book.deliveryDaysMin, max: book.deliveryDaysMax }), note: dict.product.delayNote },
              ...(book.priceCents != null ? [{ label: dict.product.facts.price, value: formatMoney(book.priceCents, currency, locale) }] : []),
            ]} />
            <div className="mt-10"><Link href={href(locale, "books", book.slug)} className="uw-textlink">{dict.collection.view} <Arrow /></Link></div>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="uw-section uw-surface">
          <div className="uw-container">
            <h2 className="uw-h2">{dict.product.related}</h2>
            <div className="mt-14 grid gap-16 md:grid-cols-2 md:gap-10 lg:max-w-4xl">
              {others.map((p) => <CollectionCard key={p.id} product={p} locale={locale} dict={dict} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
