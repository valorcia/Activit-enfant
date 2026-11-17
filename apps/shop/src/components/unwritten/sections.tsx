import Link from "next/link";
import type { Locale } from "@/lib/unwritten/constants";
import { fill, formatMoney, type Dictionary } from "@/lib/unwritten/i18n";
import { href } from "@/lib/unwritten/i18n/routing";
import type { UwProduct } from "@/lib/unwritten/catalog";
import { BookCover } from "./cover";

/** Briques communes des pages UNWRITTEN (composants serveur). */

export function Arrow() {
  return <span aria-hidden className="uw-arrow">→</span>;
}

export function SectionHead({ eyebrow, title, lead, align = "left", className = "" }: { eyebrow?: string; title: string; lead?: string; align?: "left" | "center"; className?: string }) {
  const center = align === "center";
  return (
    <div className={`${center ? "mx-auto text-center" : ""} max-w-3xl ${className}`}>
      {eyebrow && <p className="uw-eyebrow">{eyebrow}</p>}
      <h2 className={`uw-h2 ${eyebrow ? "mt-5" : ""}`}>{title}</h2>
      {lead && <p className={`uw-lead mt-6 ${center ? "mx-auto" : ""}`}>{lead}</p>}
    </div>
  );
}

export function priceFrom(dict: Dictionary, p: Pick<UwProduct, "priceCents" | "currency">, locale: Locale): string | null {
  return p.priceCents == null ? null : fill(dict.common.from, { price: formatMoney(p.priceCents, p.currency, locale) });
}

export function CollectionCard({ product, locale, dict }: { product: UwProduct; locale: Locale; dict: Dictionary }) {
  const link = product.collectionSlug ? href(locale, "collections", product.collectionSlug) : href(locale, "books", product.slug);
  return (
    <Link href={link} className="group block">
      <div className="bg-[#EFEBE3] px-[14%] py-10 md:py-[12%] transition-colors duration-500 group-hover:bg-[#ECE7DE]">
        <div className="mx-auto max-w-[240px] transition-transform duration-700 ease-out group-hover:-translate-y-1.5 md:max-w-none">
          <BookCover collectionKey={product.collectionKey} title={product.name} locale={locale} />
        </div>
      </div>
      <div className="mt-6 flex items-baseline justify-between gap-4">
        <h3 className="uw-h3">{product.name}</h3>
        {product.priceCents != null && <p className="shrink-0 text-sm text-[var(--uw-muted)]">{formatMoney(product.priceCents, product.currency, locale)}</p>}
      </div>
      <p className="uw-body mt-2 max-w-sm">{product.content.tagline}</p>
      <p className="mt-5"><span className="uw-textlink">{dict.common.discover} <Arrow /></span></p>
    </Link>
  );
}

export function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="uw-faq">
      {items.map((it, i) => (
        <details key={i}>
          <summary>{it.q}</summary>
          <div><p className="uw-body">{it.a}</p></div>
        </details>
      ))}
    </div>
  );
}

export function Facts({ rows }: { rows: Array<{ label: string; value: string; note?: string }> }) {
  return (
    <dl className="divide-y divide-[var(--uw-line)] border-y border-[var(--uw-line)]">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-4 py-4">
          <dt className="uw-eyebrow !tracking-[0.2em] pt-0.5">{r.label}</dt>
          <dd className="text-[0.95rem] leading-relaxed">{r.value}{r.note && <span className="uw-small mt-1 block">{r.note}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function pagesLabel(dict: Dictionary, p: Pick<UwProduct, "pagesMin" | "pagesMax">): string | null {
  if (p.pagesMin && p.pagesMax && p.pagesMin !== p.pagesMax) return fill(dict.common.pagesRange, { min: p.pagesMin, max: p.pagesMax });
  const n = p.pagesMax ?? p.pagesMin;
  return n ? fill(dict.common.pagesAbout, { count: n }) : null;
}
