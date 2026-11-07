"use client";
import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReviewAction, type ReviewActionState } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";

export function ReviewForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(submitReviewAction, undefined);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);

  if (state?.ok) return <Alert variant="success" title="Avis envoyé">{state.message}</Alert>;

  return (
    <form action={action} className="card-soft space-y-4 p-5 sm:p-6">
      <input type="hidden" name="productId" value={productId} />
      <div className="hidden" aria-hidden><label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <p className="font-heading text-xl font-bold">Donnez votre avis</p>
      <fieldset>
        <legend className="text-sm font-bold">Votre note</legend>
        <div className="mt-1 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} étoile${n > 1 ? "s" : ""}`} aria-pressed={rating === n} className="rounded-full p-0.5 focus-visible:ring-2 focus-visible:ring-sky">
              <Star className="size-7" fill={n <= (hover || rating) ? "var(--brand-honey)" : "none"} stroke={n <= (hover || rating) ? "var(--brand-honey)" : "currentColor"} />
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="rv-name"><Input id="rv-name" name="authorName" required minLength={2} maxLength={60} autoComplete="given-name" /></Field>
        <Field label="Email (non publié)" htmlFor="rv-email"><Input id="rv-email" name="email" type="email" required autoComplete="email" /></Field>
      </div>
      <Field label="Titre (facultatif)" htmlFor="rv-title"><Input id="rv-title" name="title" maxLength={120} /></Field>
      <Field label="Votre avis" htmlFor="rv-body" hint="20 caractères minimum."><Textarea id="rv-body" name="body" required minLength={20} maxLength={2000} /></Field>
      <label className="flex items-start gap-2 text-xs text-ink-soft">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-coral" />
        <span>J&apos;accepte que mon prénom et mon avis soient publiés sur le site après modération.</span>
      </label>
      {state && !state.ok && <Alert variant="danger">{state.error}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? "Envoi…" : "Envoyer mon avis"}</Button>
    </form>
  );
}
