"use client";
import { useActionState } from "react";
import { LogIn, Send } from "lucide-react";
import { loginCreatorAction, requestCreatorLinkAction, type CreatorFormState } from "@/app/actions/creator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";

export function RequestLinkForm() {
  const [state, action, pending] = useActionState<CreatorFormState | undefined, FormData>(requestCreatorLinkAction, undefined);
  if (state?.ok) return <Alert variant="success" title="E-mail envoyé">{state.message} Pensez à vérifier vos courriers indésirables.</Alert>;
  return (
    <form action={action} className="space-y-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label="Votre adresse e-mail" htmlFor="creator-email"><Input id="creator-email" name="email" type="email" required autoComplete="email" placeholder="prenom@exemple.fr" /></Field>
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}><Send className="size-4" /> {pending ? "Envoi…" : "Recevoir mon lien de connexion"}</Button>
    </form>
  );
}

export function TokenLoginForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<CreatorFormState | undefined, FormData>(loginCreatorAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="jeton" value={token} />
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}><LogIn className="size-5" /> {pending ? "Connexion…" : "Me connecter"}</Button>
    </form>
  );
}
