import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { getSetting } from "@/lib/settings";
import { RequestLinkForm, TokenLoginForm } from "@/components/creator/login-forms";

export const metadata: Metadata = { title: "Connexion · Espace créatrice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Connexion par lien magique. Le lien reçu par e-mail ouvre cette page avec ?jeton=… ;
 * la connexion n'a lieu qu'au clic sur « Me connecter » (un antivirus de messagerie qui
 * ouvre le lien ne le consomme donc pas).
 */
export default async function CreatorLoginPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const [{ jeton }, brand] = await Promise.all([searchParams, getSetting("brand")]);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card-soft w-full max-w-md p-6 sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-honey-light text-honey-dark"><Lightbulb className="size-7" /></span>
        <h1 className="mt-4 font-heading text-3xl font-bold">Espace créatrice</h1>
        {jeton ? (
          <>
            <p className="mt-2 text-ink-soft">Bienvenue ! Cliquez pour ouvrir votre espace {brand.name}.</p>
            <div className="mt-6"><TokenLoginForm token={jeton} /></div>
            <details className="mt-6 text-sm text-ink-soft"><summary className="cursor-pointer font-semibold">Lien expiré ? Recevoir un nouveau lien</summary><div className="mt-4"><RequestLinkForm /></div></details>
          </>
        ) : (
          <>
            <p className="mt-2 text-ink-soft">Pas de mot de passe : indiquez l&apos;adresse e-mail de votre invitation, nous vous envoyons un lien de connexion personnel.</p>
            <div className="mt-6"><RequestLinkForm /></div>
            <p className="mt-6 text-xs text-ink-muted">L&apos;espace créatrice est pour l&apos;instant ouvert sur invitation. <Link href="/" className="underline">Retour à la boutique</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
