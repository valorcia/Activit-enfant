"use client";
import { useActionState } from "react";
import { Mail, Send } from "lucide-react";
import { subscribeNewsletterAction, type NewsletterState } from "@/app/actions/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

const CONSENT_TEXT = "J'accepte de recevoir par email les nouvelles aventures et offres promotionnelles. Désinscription possible à tout moment.";

export function NewsletterForm({ source = "homepage", compact = false, className }: { source?: string; compact?: boolean; className?: string }) {
  const [state, action, pending] = useActionState<NewsletterState | undefined, FormData>(subscribeNewsletterAction, undefined);
  if (state?.ok) {
    return <Alert variant="success" className={className} title="Merci !">{state.message}</Alert>;
  }
  return (
    <form action={action} className={cn("space-y-3", className)} aria-label="Inscription à la newsletter">
      <input type="hidden" name="source" value={source} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className={cn("flex flex-col gap-2", !compact && "sm:flex-row")}>
        {!compact && (
          <Input name="firstName" placeholder="Prénom (facultatif)" aria-label="Prénom" autoComplete="given-name" className="sm:max-w-[180px]" />
        )}
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input type="email" name="email" required placeholder="Votre adresse email" aria-label="Adresse email" autoComplete="email" className="pl-11" />
        </div>
        <Button type="submit" disabled={pending} className="shrink-0">
          <Send className="size-4" /> {pending ? "Envoi…" : "Je m'inscris"}
        </Button>
      </div>
      <label className="flex items-start gap-2 text-xs text-ink-soft">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-coral" />
        <span>{CONSENT_TEXT}</span>
      </label>
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
    </form>
  );
}
