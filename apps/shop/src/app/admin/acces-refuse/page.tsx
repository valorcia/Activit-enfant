import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AccessDenied() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="font-heading text-3xl font-bold">Accès refusé</h1>
      <p className="mt-3 text-ink-soft">Votre rôle ne permet pas d&apos;accéder à cette section. Contactez un administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.</p>
      <Button asChild variant="admin" className="mt-6"><Link href="/admin">Retour au tableau de bord</Link></Button>
    </div>
  );
}
