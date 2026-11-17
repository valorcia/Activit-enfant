import Link from "next/link";
import type { Locale } from "@/lib/unwritten/constants";
import type { Dictionary } from "@/lib/unwritten/i18n";
import { href } from "@/lib/unwritten/i18n/routing";
import type { UwProduct } from "@/lib/unwritten/catalog";

export function UwFooter({ locale, dict, products, contactEmail, preview }: { locale: Locale; dict: Dictionary; products: UwProduct[]; contactEmail: string | null; preview: boolean }) {
  const f = dict.common.footer;
  return (
    <footer className="uw-dark mt-auto">
      <div className="uw-container grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr] md:py-24">
        <div>
          <p className="uw-wordmark">UNWRITTEN</p>
          <p className="uw-serif uw-italic mt-6 text-2xl leading-snug text-[var(--uw-ivory)]">{dict.common.tagline}</p>
          <p className="uw-body mt-4 max-w-sm !text-sm">{f.about}</p>
        </div>
        <div>
          <p className="uw-eyebrow">{dict.common.nav.collections}</p>
          <ul className="mt-5 space-y-3 text-sm">
            {products.map((p) => (
              <li key={p.id}><Link href={href(locale, "books", p.slug)} className="text-[rgb(247_244_238/.85)] transition-colors hover:text-white">{p.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="uw-eyebrow">{dict.common.nav.faq}</p>
          <ul className="mt-5 space-y-3 text-sm">
            <li><a href={`${href(locale)}#how`} className="text-[rgb(247_244_238/.85)] hover:text-white">{dict.common.nav.how}</a></li>
            <li><a href={`${href(locale)}#faq`} className="text-[rgb(247_244_238/.85)] hover:text-white">{dict.common.nav.faq}</a></li>
            {contactEmail && <li><a href={`mailto:${contactEmail}`} className="text-[rgb(247_244_238/.85)] hover:text-white">{f.contact}</a></li>}
          </ul>
        </div>
      </div>
      <div className="uw-container flex flex-col gap-3 border-t border-[rgb(247_244_238/.12)] py-7 text-xs text-[rgb(247_244_238/.55)] md:flex-row md:items-center md:justify-between">
        <p>{f.privacy}</p>
        {preview ? <p>{f.test}</p> : <p>© {new Date().getFullYear()} {f.rights}</p>}
      </div>
    </footer>
  );
}
