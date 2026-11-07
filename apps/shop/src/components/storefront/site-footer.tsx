import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { BrandSettings, NavigationSettings } from "@/lib/schemas/settings";

export function SiteFooter({ brand, navigation, legalPages }: { brand: BrandSettings; navigation: NavigationSettings; legalPages: Array<{ slug: string; title: string }> }) {
  const social = Object.entries(navigation.social).filter(([, v]) => !!v) as Array<[string, string]>;
  return (
    <footer className="mt-20 bg-ink text-cream">
      <div className="container-shell grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(2,1fr)] lg:grid-cols-[1.6fr_repeat(3,1fr)]">
        <div>
          <p className="font-heading text-2xl font-bold">{brand.name}</p>
          <p className="mt-3 max-w-sm text-sm text-cream/75 leading-relaxed">{navigation.footerText}</p>
          {social.length > 0 && (
            <ul className="mt-5 flex gap-2">
              {social.map(([k, href]) => (
                <li key={k}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={k} className="grid size-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-coral">
                    <Icon name={k === "tiktok" ? "music-2" : k} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {navigation.footerColumns.map((col) => (
          <div key={col.title}>
            <p className="font-heading font-bold text-honey">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-cream/80 transition-colors hover:text-white">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="font-heading font-bold text-honey">Informations</p>
          <ul className="mt-3 space-y-2 text-sm">
            {legalPages.map((p) => (
              <li key={p.slug}><Link href={`/pages/${p.slug}`} className="text-cream/80 transition-colors hover:text-white">{p.title}</Link></li>
            ))}
            <li><Link href="/mes-achats" className="text-cream/80 transition-colors hover:text-white">Retrouver mes achats</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-shell flex flex-col gap-2 py-5 text-xs text-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {brand.legalName ?? brand.name}. Tous droits réservés.</p>
          <p>Paiement sécurisé par Stripe · Fichiers numériques à télécharger</p>
        </div>
      </div>
    </footer>
  );
}
