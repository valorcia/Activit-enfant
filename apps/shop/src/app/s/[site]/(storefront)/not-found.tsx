import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceholderArt } from "@/components/storefront/placeholder-art";

export default function NotFound() {
  return (
    <div className="container-shell grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-honey-light px-3 py-1 font-heading text-sm font-bold text-honey-dark"><Compass className="size-4" /> Erreur 404</p>
        <h1 className="mt-4 font-heading text-4xl font-bold leading-tight sm:text-5xl">Oups, cette carte ne mène nulle part…</h1>
        <p className="mt-4 text-lg text-ink-soft">La page que vous cherchez a peut-être été déplacée ou n&apos;existe plus. Le trésor, lui, est toujours dans la boutique.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/boutique">Explorer la boutique</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/">Retour à l&apos;accueil</Link></Button>
          <Button asChild size="lg" variant="ghost"><Link href="/mes-achats">Retrouver mes achats</Link></Button>
        </div>
      </div>
      <div className="card-soft overflow-hidden p-2"><div className="aspect-[4/3] overflow-hidden rounded-[calc(var(--radius-card)-0.5rem)]"><PlaceholderArt universe="Pirates" label="Trésor introuvable" /></div></div>
    </div>
  );
}
