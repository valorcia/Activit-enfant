"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { checkoutAction, deleteDraftAction, requestResumeLinkAction, rotateGiftLinkAction, giftCompleteAction, type UwFormState } from "@/app/actions/unwritten";
import type { Locale } from "@/lib/unwritten/constants";

function Pending({ label, busy, className = "uw-btn" }: { label: string; busy: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending}>{pending ? busy : label}</button>;
}

/** « Terminer plus tard » : lien magique envoyé par e-mail. */
export function SaveLater({ locale, draftId, labels, busy, defaultEmail }: { locale: Locale; draftId: string; labels: { title: string; text: string; email: string; submit: string }; busy: string; defaultEmail?: string | null }) {
  const [state, action] = useActionState<UwFormState | undefined, FormData>(requestResumeLinkAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="draft" value={draftId} />
      <div aria-hidden className="hidden"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <p className="uw-serif text-[1.35rem] leading-tight">{labels.title}</p>
      <p className="uw-small">{labels.text}</p>
      {state?.ok ? (
        <p role="status" className="text-[0.9rem] leading-relaxed">{state.message}</p>
      ) : (
        <>
          <label className="sr-only" htmlFor="resume-email">{labels.email}</label>
          <input id="resume-email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder={labels.email} defaultValue={defaultEmail ?? ""} className="uw-input !min-h-[48px] !py-3 text-[0.95rem]" />
          {(state?.error || state?.errors?.email) && <p className="uw-error" role="alert">{state.error ?? state.errors?.email}</p>}
          <Pending label={labels.submit} busy={busy} className="uw-btn uw-btn--ghost uw-btn--block !min-h-[46px]" />
        </>
      )}
    </form>
  );
}

export function DeleteDraft({ locale, draftId, productSlug, label, confirm }: { locale: Locale; draftId: string; productSlug: string; label: string; confirm: string }) {
  return (
    <form action={deleteDraftAction} onSubmit={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="draft" value={draftId} />
      <input type="hidden" name="product" value={productSlug} />
      <button type="submit" className="text-[0.8125rem] text-[var(--uw-muted)] underline underline-offset-4 hover:text-[var(--uw-ink)]">{label}</button>
    </form>
  );
}

/** Paiement : e-mail de l'acheteur puis redirection vers Stripe Checkout. */
export function CheckoutForm({ locale, draftId, defaultEmail, labels, disabled }: { locale: Locale; draftId: string; defaultEmail?: string | null; labels: { email: string; pay: string; secure: string; busy: string; notice: string }; disabled?: boolean }) {
  const [state, action] = useActionState<UwFormState | undefined, FormData>(checkoutAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="draft" value={draftId} />
      <div>
        <label htmlFor="checkout-email" className="uw-eyebrow !tracking-[0.18em]">{labels.email}</label>
        <input id="checkout-email" name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={defaultEmail ?? ""} className="uw-input mt-3" aria-invalid={!!state?.errors?.email} />
        {state?.errors?.email && <p className="uw-error">{state.errors.email}</p>}
      </div>
      <p className="uw-small">{labels.notice}</p>
      {state?.error && <p role="alert" className="uw-error !text-[0.95rem]">{state.error}</p>}
      {disabled ? <button type="button" className="uw-btn uw-btn--block" disabled>{labels.pay}</button> : <Pending label={labels.pay} busy={labels.busy} className="uw-btn uw-btn--block" />}
      <p className="uw-small text-center">{labels.secure}</p>
    </form>
  );
}

export function GiftComplete({ locale, token, label, busy }: { locale: Locale; token: string; label: string; busy: string }) {
  const [state, action] = useActionState<UwFormState | undefined, FormData>(giftCompleteAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      {state?.error && <p role="alert" className="uw-error">{state.error}</p>}
      <Pending label={label} busy={busy} className="uw-btn uw-btn--block sm:w-auto" />
    </form>
  );
}

export function GiftLinkRotator({ locale, orderToken, itemId, labels }: { locale: Locale; orderToken: string; itemId: string; labels: { cta: string; busy: string } }) {
  const [state, action] = useActionState<UwFormState | undefined, FormData>(rotateGiftLinkAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="orderToken" value={orderToken} />
      <input type="hidden" name="item" value={itemId} />
      {state?.link && <p className="break-all border border-[var(--uw-line-strong)] bg-white px-4 py-3 text-[0.85rem]"><a href={state.link} className="uw-underline">{state.link}</a></p>}
      {state?.error && <p role="alert" className="uw-error">{state.error}</p>}
      <Pending label={labels.cta} busy={labels.busy} className="uw-btn uw-btn--ghost !min-h-[46px]" />
    </form>
  );
}
