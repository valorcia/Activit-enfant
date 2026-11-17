"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/unwritten/constants";
import { href, switchLocale } from "@/lib/unwritten/i18n/routing";

/** En-tête de la vitrine : marque, navigation, sélecteur de langue (mémorisé par le proxy), appel à l'action. */
export function UwHeader({ locale, locales, labels }: {
  locale: Locale;
  locales: Locale[];
  labels: { collections: string; how: string; faq: string; start: string; language: string; languages: Record<Locale, string> };
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const home = href(locale);
  return (
    <header className="uw-header" data-scrolled={scrolled}>
      <div className="uw-container flex h-16 items-center justify-between gap-6 md:h-[76px]">
        <Link href={home} className="uw-wordmark" aria-label="UNWRITTEN">UNWRITTEN</Link>
        <nav className="uw-nav hidden items-center gap-9 md:flex" aria-label="Navigation">
          <a href={`${home}#collections`}>{labels.collections}</a>
          <a href={`${home}#how`}>{labels.how}</a>
          <a href={`${home}#faq`}>{labels.faq}</a>
        </nav>
        <div className="flex items-center gap-5 md:gap-7">
          <LanguageSwitcher locale={locale} locales={locales} label={labels.language} names={labels.languages} />
          <span className="hidden sm:block"><a href={`${home}#collections`} className="uw-btn uw-btn--ghost !min-h-[42px] !px-5">{labels.start}</a></span>
        </div>
      </div>
    </header>
  );
}

export function LanguageSwitcher({ locale, locales, label, names }: { locale: Locale; locales: Locale[]; label: string; names: Record<Locale, string> }) {
  const pathname = usePathname() ?? "/";
  if (locales.length < 2) return null;
  // L'URL interne (/u/en/books/x) est réécrite par le proxy : on reconstruit l'URL publique
  const publicPath = pathname.startsWith("/u/") ? pathname.slice(2) : pathname;
  return (
    <nav className="uw-lang flex items-center gap-3" aria-label={label}>
      {locales.map((l, i) => (
        <span key={l} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden className="text-[var(--uw-stone)]">/</span>}
          <a href={switchLocale(publicPath, l)} hrefLang={l} lang={l} aria-current={l === locale} title={names[l]}>{l.toUpperCase()}</a>
        </span>
      ))}
    </nav>
  );
}
