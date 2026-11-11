import { formatPrice } from "@/lib/utils";

interface Brand { name: string; appUrl: string; contactEmail?: string | null; color?: string }

function layout(brand: Brand, title: string, body: string, footer?: string): string {
  const color = brand.color ?? "#FF826F";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#FFF9F0;font-family:'Nunito',Helvetica,Arial,sans-serif;color:#293241;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9F0;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(41,50,65,.08);">
<tr><td style="background:${color};padding:28px 32px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-.01em;">${escapeHtml(brand.name)}</td></tr>
<tr><td style="padding:32px;font-size:16px;line-height:1.6;">${body}</td></tr>
<tr><td style="padding:20px 32px;background:#FFF4E6;font-size:12px;color:#6b7280;line-height:1.5;">
${footer ?? ""}
<p style="margin:8px 0 0;">${escapeHtml(brand.name)} · <a href="${brand.appUrl}" style="color:#6b7280;">${brand.appUrl.replace(/^https?:\/\//, "")}</a>${brand.contactEmail ? ` · <a href="mailto:${brand.contactEmail}" style="color:#6b7280;">${brand.contactEmail}</a>` : ""}</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string, color = "#FF826F"): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:999px;font-size:16px;">${escapeHtml(label)}</a></p>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export interface OrderEmailItem { name: string; quantity: number; totalCents: number; downloadUrl?: string }

export function orderConfirmationEmail(brand: Brand, opts: {
  orderNumber: string;
  customerName?: string | null;
  items: OrderEmailItem[];
  totalCents: number;
  currency: string;
  accessUrl: string;
  invoiceUrl?: string;
}) {
  const rows = opts.items.map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1e9dc;">
        <strong>${escapeHtml(it.name)}</strong>${it.quantity > 1 ? ` × ${it.quantity}` : ""}
        ${it.downloadUrl ? `<br><a href="${it.downloadUrl}" style="color:#FF826F;font-weight:700;">Télécharger</a>` : ""}
      </td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #f1e9dc;white-space:nowrap;">${formatPrice(it.totalCents, opts.currency)}</td>
    </tr>`).join("");
  const body = `
    <h1 style="font-size:24px;margin:0 0 12px;">Merci ${opts.customerName ? escapeHtml(opts.customerName) : ""} ! Votre aventure est prête 🎉</h1>
    <p>Votre commande <strong>${escapeHtml(opts.orderNumber)}</strong> est confirmée. Vos fichiers sont disponibles immédiatement.</p>
    ${button(opts.accessUrl, "Télécharger mes fichiers")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">${rows}
      <tr><td style="padding:12px 0;font-weight:800;">Total</td><td align="right" style="padding:12px 0;font-weight:800;">${formatPrice(opts.totalCents, opts.currency)}</td></tr>
    </table>
    <p style="font-size:14px;color:#6b7280;">Ce lien reste valable : vous pourrez à tout moment retrouver vos achats depuis la page « Retrouver mes achats » en indiquant votre adresse email.</p>
    ${opts.invoiceUrl ? `<p style="font-size:14px;"><a href="${opts.invoiceUrl}" style="color:#293241;">Voir ma facture</a></p>` : ""}
    <p>Bonne aventure en famille !</p>`;
  const text = `Merci ! Votre commande ${opts.orderNumber} est confirmée.\nTéléchargez vos fichiers : ${opts.accessUrl}\n\n${opts.items.map((i) => `- ${i.name} : ${formatPrice(i.totalCents, opts.currency)}`).join("\n")}\nTotal : ${formatPrice(opts.totalCents, opts.currency)}`;
  return { subject: `Votre commande ${opts.orderNumber} est prête à télécharger`, html: layout(brand, "Commande confirmée", body), text };
}

export function filesReadyEmail(brand: Brand, opts: { orderNumber: string; productName: string; accessUrl: string }) {
  const body = `
    <h1 style="font-size:24px;margin:0 0 12px;">Vos fichiers sont prêts 🎉</h1>
    <p>Les fichiers de <strong>${escapeHtml(opts.productName)}</strong> (commande <strong>${escapeHtml(opts.orderNumber)}</strong>) sont maintenant disponibles.</p>
    ${button(opts.accessUrl, "Télécharger mes fichiers")}
    <p style="font-size:14px;color:#6b7280;">Vous pourrez aussi les retrouver à tout moment depuis la page « Retrouver mes achats » en indiquant votre adresse email.</p>
    <p>Bonne aventure en famille !</p>`;
  return {
    subject: `Vos fichiers « ${opts.productName} » sont prêts`,
    html: layout(brand, "Fichiers disponibles", body),
    text: `Les fichiers de ${opts.productName} (commande ${opts.orderNumber}) sont disponibles : ${opts.accessUrl}`,
  };
}

export function accessLinkEmail(brand: Brand, opts: { accessUrl: string; expiresHours: number }) {
  const body = `
    <h1 style="font-size:24px;margin:0 0 12px;">Retrouvez vos achats</h1>
    <p>Voici votre lien personnel pour accéder à tous vos fichiers. Il est valable ${opts.expiresHours} heures.</p>
    ${button(opts.accessUrl, "Accéder à mes achats")}
    <p style="font-size:14px;color:#6b7280;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.</p>`;
  return { subject: `Votre lien d'accès à vos achats`, html: layout(brand, "Mes achats", body), text: `Accédez à vos achats : ${opts.accessUrl} (valable ${opts.expiresHours} h)` };
}

export function newsletterConfirmEmail(brand: Brand, opts: { confirmUrl: string }) {
  const body = `
    <h1 style="font-size:24px;margin:0 0 12px;">Une dernière étape !</h1>
    <p>Confirmez votre inscription pour recevoir nos nouvelles aventures, idées d'activités et offres réservées aux abonnés.</p>
    ${button(opts.confirmUrl, "Je confirme mon inscription")}
    <p style="font-size:14px;color:#6b7280;">Vous pourrez vous désinscrire à tout moment en un clic.</p>`;
  return { subject: `Confirmez votre inscription`, html: layout(brand, "Confirmation", body), text: `Confirmez votre inscription : ${opts.confirmUrl}` };
}

export function abandonedCartEmail(brand: Brand, opts: { items: string[]; resumeUrl: string; unsubscribeUrl: string }) {
  const body = `
    <h1 style="font-size:24px;margin:0 0 12px;">Votre aventure vous attend</h1>
    <p>Vous aviez commencé à préparer une commande : ${opts.items.map(escapeHtml).join(", ")}.</p>
    <p>Elle est toujours disponible, prête à être téléchargée dès le paiement validé.</p>
    ${button(opts.resumeUrl, "Reprendre ma commande")}`;
  const footer = `<a href="${opts.unsubscribeUrl}" style="color:#6b7280;">Ne plus recevoir ce type de rappel</a>`;
  return { subject: `Votre panier vous attend`, html: layout(brand, "Panier", body, footer), text: `Reprenez votre commande : ${opts.resumeUrl}` };
}

export function refundEmail(brand: Brand, opts: { orderNumber: string; amountCents: number; currency: string }) {
  const body = `
    <h1 style="font-size:24px;margin:0 0 12px;">Remboursement effectué</h1>
    <p>Un remboursement de <strong>${formatPrice(opts.amountCents, opts.currency)}</strong> a été émis pour votre commande ${escapeHtml(opts.orderNumber)}. Il apparaîtra sur votre relevé sous 5 à 10 jours.</p>`;
  return { subject: `Remboursement de la commande ${opts.orderNumber}`, html: layout(brand, "Remboursement", body), text: `Remboursement de ${formatPrice(opts.amountCents, opts.currency)} pour la commande ${opts.orderNumber}.` };
}

export function newProductEmail(brand: Brand, opts: { productName: string; productUrl: string; tagline?: string | null; unsubscribeUrl: string }) {
  const body = `
    <h1 style="font-size:24px;margin:0 0 12px;">Nouvelle aventure : ${escapeHtml(opts.productName)}</h1>
    ${opts.tagline ? `<p>${escapeHtml(opts.tagline)}</p>` : ""}
    ${button(opts.productUrl, "Découvrir")}`;
  const footer = `<a href="${opts.unsubscribeUrl}" style="color:#6b7280;">Se désinscrire</a>`;
  return { subject: `Nouveau : ${opts.productName}`, html: layout(brand, "Nouveauté", body, footer), text: `Nouvelle aventure : ${opts.productName} — ${opts.productUrl}` };
}
