"use client";
import { useActionState } from "react";
import { FileSignature } from "lucide-react";
import { acceptContractAction, type CreatorFormState } from "@/app/actions/creator";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";

export function ContractForm({ version }: { version: string }) {
  const [state, action, pending] = useActionState<CreatorFormState | undefined, FormData>(acceptContractAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="version" value={version} />
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 text-sm">
        <input type="checkbox" name="accept" required className="mt-0.5 size-5 shrink-0 accent-coral" />
        <span>J&apos;ai lu et j&apos;accepte le contrat créatrice (version {version}). Je garantis que mes idées et mes photos sont les miennes et que les photos ne montrent pas de visage d&apos;enfant reconnaissable sans l&apos;accord écrit des deux parents.</span>
      </label>
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}><FileSignature className="size-5" /> {pending ? "Enregistrement…" : "J'accepte le contrat"}</Button>
    </form>
  );
}
