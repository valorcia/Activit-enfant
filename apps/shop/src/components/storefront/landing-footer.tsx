import Link from "next/link";
import { Lock } from "lucide-react";
import type { BrandSettings } from "@/lib/schemas/settings";

/** Pied de page compact des landing pages produit. */
export function LandingFooter({ brand, legalPages }: { brand: BrandSettings; legalPages: Array<{ slug: string; title: string }> }) {
  return (
    <footer className="mt-16 border-t border-line bg-cream">
      <div className="container-shell flex flex-col gap-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-heading text-lg font-bold">{brand.name}</Link>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted sm:ml-3 sm:mt-0">
            <Lock className="size-3.5" aria-hidden /> Paiement sécurisé Stripe · Fichiers numériques à télécharger
          </p>
        </div>
        <nav aria-label="Informations" className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-ink-soft">
          <Link href="/boutique" className="hover:text-ink">Toutes les aventures</Link>
          <Link href="/mes-achats" className="hover:text-ink">Retrouver mes achats</Link>
          {legalPages.map((p) => (
            <Link key={p.slug} href={`/pages/${p.slug}`} className="hover:text-ink">{p.title}</Link>
          ))}
        </nav>
      </div>
      <div className="container-shell pb-5 text-[11px] text-ink-muted">© {new Date().getFullYear()} {brand.legalName ?? brand.name}. Tous droits réservés.</div>
    </footer>
  );
}
