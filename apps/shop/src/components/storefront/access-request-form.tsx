"use client";
import { useActionState } from "react";
import { Send } from "lucide-react";
import { requestAccessLinkAction, type AccessState } from "@/app/actions/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";

export function AccessRequestForm() {
  const [state, action, pending] = useActionState<AccessState | undefined, FormData>(requestAccessLinkAction, undefined);
  if (state?.ok) return <Alert variant="success" title="Email envoyé">{state.message} Pensez à vérifier vos courriers indésirables.</Alert>;
  return (
    <form action={action} className="space-y-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label="Adresse email de la commande" htmlFor="access-email"><Input id="access-email" name="email" type="email" required autoComplete="email" placeholder="prenom@exemple.fr" /></Field>
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}><Send className="size-4" /> {pending ? "Envoi…" : "Recevoir mon lien d'accès"}</Button>
    </form>
  );
}
