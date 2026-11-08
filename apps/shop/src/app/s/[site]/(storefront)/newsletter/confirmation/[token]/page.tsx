import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck, MailX } from "lucide-react";
import { confirmNewsletter } from "@/lib/marketing/newsletter";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Confirmation d'inscription", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewsletterConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await confirmNewsletter(token);
  return (
    <div className="container-shell max-w-xl py-16 text-center">
      <span className={`mx-auto grid size-20 place-items-center rounded-full ${ok ? "bg-sage-light text-sage-dark" : "bg-honey-light text-honey-dark"}`}>{ok ? <MailCheck className="size-10" /> : <MailX className="size-10" />}</span>
      <h1 className="mt-5 font-heading text-3xl font-bold">{ok ? "Inscription confirmée !" : "Lien invalide"}</h1>
      <p className="mt-3 text-ink-soft">{ok ? "Merci ! Vous recevrez nos nouvelles aventures et offres. Vous pouvez vous désinscrire à tout moment depuis chaque email." : "Ce lien de confirmation n'est plus valable ou a déjà été utilisé. Vous pouvez vous réinscrire depuis la page d'accueil."}</p>
      <Button asChild className="mt-6"><Link href="/boutique">Découvrir les aventures</Link></Button>
    </div>
  );
}
