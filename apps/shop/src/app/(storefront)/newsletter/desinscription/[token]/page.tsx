import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeNewsletter } from "@/lib/marketing/newsletter";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Désinscription", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewsletterUnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await unsubscribeNewsletter(token);
  return (
    <div className="container-shell max-w-xl py-16 text-center">
      <h1 className="font-heading text-3xl font-bold">{ok ? "Vous êtes désinscrit·e" : "Lien invalide"}</h1>
      <p className="mt-3 text-ink-soft">{ok ? "Vous ne recevrez plus nos emails. Merci d'avoir fait un bout de chemin avec nous : la boutique reste ouverte quand vous le souhaitez." : "Ce lien de désinscription n'est pas reconnu. Écrivez-nous depuis la page contact et nous nous en occupons."}</p>
      <Button asChild variant="outline" className="mt-6"><Link href="/">Retour à l&apos;accueil</Link></Button>
    </div>
  );
}
