import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlaceholderArt } from "@/components/storefront/placeholder-art";

export default function ProductNotFound() {
  return (
    <div className="container-shell py-16 text-center">
      <div className="mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] shadow-card">
        <PlaceholderArt label="Trésor introuvable" />
      </div>
      <h1 className="mt-8 font-heading text-3xl font-bold sm:text-4xl">Cette aventure n&apos;existe pas (ou plus)</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-soft">La carte au trésor semble avoir été égarée. Découvrez nos autres aventures à imprimer.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild><Link href="/boutique">Voir toutes les aventures</Link></Button>
        <Button asChild variant="outline"><Link href="/">Retour à l&apos;accueil</Link></Button>
      </div>
    </div>
  );
}
