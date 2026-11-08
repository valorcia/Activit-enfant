import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { AccessRequestForm } from "@/components/storefront/access-request-form";

export const metadata: Metadata = { title: "Retrouver mes achats", description: "Recevez par email un lien sécurisé pour télécharger à nouveau vos kits achetés." };

export default function MesAchatsPage() {
  return (
    <div className="container-shell max-w-xl py-10 sm:py-16">
      <Breadcrumbs items={[{ label: "Mes achats" }]} className="mb-6" />
      <div className="card-soft p-6 sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-sky-light text-sky-dark"><KeyRound className="size-7" /></span>
        <h1 className="mt-4 font-heading text-3xl font-bold">Retrouver mes achats</h1>
        <p className="mt-2 text-ink-soft">Pas de compte, pas de mot de passe : indiquez l&apos;adresse email utilisée lors de votre commande et nous vous envoyons un lien d&apos;accès sécurisé à tous vos fichiers.</p>
        <div className="mt-6"><AccessRequestForm /></div>
      </div>
    </div>
  );
}
