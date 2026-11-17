import { escapeHtml } from "@/lib/email/templates";
import type { Locale } from "./constants";
import { fill, formatMoney } from "./i18n";

/**
 * E-mails transactionnels UNWRITTEN, localisés (EN/FR), dans l'identité de la marque :
 * ivoire, noir, accent champagne discret, titres en serif. Fonctions pures (testables).
 */

export interface UwBrand { name: string; url: string; contactEmail?: string | null }

const C = { ivory: "#F7F4EE", ink: "#171717", champagne: "#C5A77B", stone: "#A7A39B", white: "#FFFFFF" };
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const T = {
  en: {
    footer: "You receive this email because of an order or a request made on {brand}.",
    orderSubject: "Your book is in preparation · {number}",
    orderTitle: "Thank you. Your book is in preparation.",
    orderIntro: "Your payment for order {number} is confirmed. We are now writing and composing your book. This private page shows its progress:",
    orderCta: "Follow my book",
    total: "Total",
    giftSentTo: "We have sent {name} a private link to complete their answers. Writing will begin once they have.",
    giftShare: "Share this private link with {name} so they can complete their answers. Writing will begin once they have:",
    giftSomeone: "the person you are offering it to",
    keepPrivate: "These links are personal. Please don't share them publicly.",
    giftSubject: "A book is waiting to be written for you",
    giftTitle: "Someone is writing a book for you.",
    giftIntro: "{from} has offered you {product}, a personalised book. Answer a few questions and it can be written.",
    giftFromSomeone: "Someone close to you",
    giftMessage: "Their message",
    giftCta: "Complete my answers",
    giftExpiry: "This link is personal and valid for {days} days.",
    resumeSubject: "Continue your book",
    resumeTitle: "Pick up where you left off.",
    resumeIntro: "Here is your private link to continue personalising {product}. It works once and is valid for {hours} hours.",
    resumeCta: "Continue my book",
    resumeIgnore: "If you did not ask for this link, simply ignore this email.",
    readySubject: "Your book is ready",
    readyTitle: "Your book is ready.",
    readyIntro: "{product} has been written for you. You can download it now from your private link.",
    readyCta: "Download my book",
    readyTrack: "View my order",
  },
  fr: {
    footer: "Vous recevez cet e-mail à la suite d'une commande ou d'une demande faite sur {brand}.",
    orderSubject: "Votre livre est en préparation · {number}",
    orderTitle: "Merci. Votre livre est en préparation.",
    orderIntro: "Le paiement de la commande {number} est confirmé. Nous écrivons et mettons en page votre livre. Cette page privée indique son avancement :",
    orderCta: "Suivre mon livre",
    total: "Total",
    giftSentTo: "Nous avons envoyé à {name} un lien privé pour compléter ses réponses. L'écriture commencera ensuite.",
    giftShare: "Transmettez ce lien privé à {name} pour qu'elle ou il complète ses réponses. L'écriture commencera ensuite :",
    giftSomeone: "la personne à qui vous l'offrez",
    keepPrivate: "Ces liens sont personnels. Merci de ne pas les partager publiquement.",
    giftSubject: "Un livre attend d'être écrit pour vous",
    giftTitle: "Quelqu'un écrit un livre pour vous.",
    giftIntro: "{from} vous offre {product}, un livre personnalisé. Répondez à quelques questions, et il pourra être écrit.",
    giftFromSomeone: "Un proche",
    giftMessage: "Son message",
    giftCta: "Compléter mes réponses",
    giftExpiry: "Ce lien est personnel et valable {days} jours.",
    resumeSubject: "Reprendre votre livre",
    resumeTitle: "Reprenez là où vous vous étiez arrêté.",
    resumeIntro: "Voici votre lien privé pour continuer la personnalisation de {product}. Il ne sert qu'une fois et reste valable {hours} heures.",
    resumeCta: "Reprendre mon livre",
    resumeIgnore: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.",
    readySubject: "Votre livre est prêt",
    readyTitle: "Votre livre est prêt.",
    readyIntro: "{product} a été écrit pour vous. Vous pouvez le télécharger dès maintenant depuis votre lien privé.",
    readyCta: "Télécharger mon livre",
    readyTrack: "Voir ma commande",
  },
} satisfies Record<Locale, Record<string, string>>;

function layout(brand: UwBrand, locale: Locale, title: string, body: string): string {
  const host = brand.url.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:${C.ivory};color:${C.ink};font-family:${SANS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory};padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 0 28px;font-family:${SANS};font-size:12px;letter-spacing:.32em;font-weight:600;">${escapeHtml(brand.name)}</td></tr>
<tr><td style="background:${C.white};padding:44px 36px;border:1px solid #E7E2D8;">${body}</td></tr>
<tr><td style="padding:24px 4px;font-size:12px;line-height:1.6;color:#6F6B64;">
${escapeHtml(fill(T[locale].footer, { brand: brand.name }))}<br>
<a href="${brand.url}" style="color:#6F6B64;">${escapeHtml(host)}</a>${brand.contactEmail ? ` · <a href="mailto:${escapeHtml(brand.contactEmail)}" style="color:#6F6B64;">${escapeHtml(brand.contactEmail)}</a>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

const h1 = (s: string) => `<h1 style="margin:0 0 18px;font-family:${SERIF};font-weight:500;font-size:30px;line-height:1.15;letter-spacing:-.01em;">${escapeHtml(s)}</h1>`;
const p = (s: string, muted = false) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;${muted ? "color:#6F6B64;font-size:13px;" : ""}">${s}</p>`;
const rule = `<div style="width:40px;height:1px;background:${C.champagne};margin:0 0 22px;"></div>`;
const button = (href: string, label: string) => `<p style="margin:26px 0;"><a href="${href}" style="display:inline-block;background:${C.ink};color:${C.white};text-decoration:none;font-size:14px;font-weight:600;letter-spacing:.02em;padding:15px 26px;">${escapeHtml(label)}</a></p>`;
const quote = (s: string) => `<p style="margin:0 0 18px;padding:2px 0 2px 16px;border-left:1px solid ${C.champagne};font-family:${SERIF};font-size:19px;line-height:1.5;font-style:italic;white-space:pre-line;">${escapeHtml(s)}</p>`;

export function personalOrderEmail(brand: UwBrand, locale: Locale, opts: {
  number: string;
  items: Array<{ name: string; totalCents: number }>;
  totalCents: number;
  currency: string;
  trackUrl: string;
  gifts: Array<{ recipientName: string | null; sentToRecipient: boolean; link: string | null }>;
}) {
  const t = T[locale];
  const rows = opts.items.map((i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #EFEAE0;font-family:${SERIF};font-size:18px;">${escapeHtml(i.name)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #EFEAE0;font-size:14px;white-space:nowrap;">${formatMoney(i.totalCents, opts.currency, locale)}</td></tr>`).join("");
  const gifts = opts.gifts.map((g) => {
    const name = escapeHtml(g.recipientName || t.giftSomeone);
    if (g.sentToRecipient) return p(fill(escapeHtml(t.giftSentTo), { name }));
    return g.link ? `${p(fill(escapeHtml(t.giftShare), { name }))}<p style="margin:0 0 16px;font-size:13px;word-break:break-all;"><a href="${g.link}" style="color:${C.ink};">${escapeHtml(g.link)}</a></p>` : "";
  }).join("");
  const body = `${h1(t.orderTitle)}${rule}${p(escapeHtml(fill(t.orderIntro, { number: opts.number })))}${button(opts.trackUrl, t.orderCta)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;">${rows}<tr><td style="padding:12px 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;">${t.total}</td><td align="right" style="padding:12px 0;font-weight:600;">${formatMoney(opts.totalCents, opts.currency, locale)}</td></tr></table>
${gifts}${p(escapeHtml(t.keepPrivate), true)}`;
  const text = `${t.orderTitle}\n${fill(t.orderIntro, { number: opts.number })}\n${opts.trackUrl}\n${opts.gifts.filter((g) => g.link && !g.sentToRecipient).map((g) => g.link).join("\n")}`;
  return { subject: fill(t.orderSubject, { number: opts.number }), html: layout(brand, locale, t.orderTitle, body), text };
}

export function giftInviteEmail(brand: UwBrand, locale: Locale, opts: { from: string | null; product: string; message: string | null; url: string; validityDays: number }) {
  const t = T[locale];
  const intro = fill(t.giftIntro, { from: opts.from || t.giftFromSomeone, product: opts.product });
  const body = `${h1(t.giftTitle)}${rule}${p(escapeHtml(intro))}${opts.message ? `<p style="margin:0 0 6px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6F6B64;">${t.giftMessage}</p>${quote(opts.message)}` : ""}${button(opts.url, t.giftCta)}${p(escapeHtml(fill(t.giftExpiry, { days: opts.validityDays })), true)}`;
  return { subject: t.giftSubject, html: layout(brand, locale, t.giftTitle, body), text: `${intro}\n${opts.message ?? ""}\n${opts.url}` };
}

export function resumeEmail(brand: UwBrand, locale: Locale, opts: { product: string; url: string; validityHours: number }) {
  const t = T[locale];
  const intro = fill(t.resumeIntro, { product: opts.product, hours: opts.validityHours });
  const body = `${h1(t.resumeTitle)}${rule}${p(escapeHtml(intro))}${button(opts.url, t.resumeCta)}${p(escapeHtml(t.resumeIgnore), true)}`;
  return { subject: t.resumeSubject, html: layout(brand, locale, t.resumeTitle, body), text: `${intro}\n${opts.url}` };
}

export function bookReadyEmail(brand: UwBrand, locale: Locale, opts: { product: string; downloadUrl: string; trackUrl: string | null }) {
  const t = T[locale];
  const intro = fill(t.readyIntro, { product: opts.product });
  const body = `${h1(t.readyTitle)}${rule}${p(escapeHtml(intro))}${button(opts.downloadUrl, t.readyCta)}${opts.trackUrl ? p(`<a href="${opts.trackUrl}" style="color:${C.ink};">${escapeHtml(t.readyTrack)}</a>`) : ""}${p(escapeHtml(t.keepPrivate), true)}`;
  return { subject: t.readySubject, html: layout(brand, locale, t.readyTitle, body), text: `${intro}\n${opts.downloadUrl}` };
}
