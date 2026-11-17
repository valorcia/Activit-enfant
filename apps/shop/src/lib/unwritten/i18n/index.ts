import { isLocale, type Locale } from "../constants";
import { en, type Dictionary } from "./en";
import { fr } from "./fr";

export type { Dictionary };
export { href, parsePublicPath, switchLocale, hreflangAlternates, negotiateLocale, ROUTE_SEGMENTS } from "./routing";

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Remplace les variables `{nom}` d'un texte. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Étiquette BCP 47 utilisée pour les formats `Intl` (nombres, dates, devises). */
export function intlLocale(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-GB";
}

/** Prix localisé dans la devise donnée (centimes → « 19,90 € » / « €19.90 »). */
export function formatMoney(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export function formatDate(date: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", year: "numeric" }).format(new Date(date));
}

/** Texte localisé `{ en, fr }` : langue demandée, sinon anglais, sinon première valeur. */
export type LocalizedText = Partial<Record<Locale, string>>;
export function pick(text: LocalizedText | string | null | undefined, locale: Locale): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return text[locale] ?? text.en ?? Object.values(text).find(Boolean) ?? "";
}

export function asLocale(value: string | null | undefined, fallback: Locale = "en"): Locale {
  return isLocale(value) ? value : fallback;
}
