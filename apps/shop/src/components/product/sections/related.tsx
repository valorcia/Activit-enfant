import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/storefront/product-card";
import { SectionHeading } from "@/components/storefront/section-heading";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { getRelatedProducts, type ProductPageData } from "@/lib/catalog";

export async function RelatedProducts({ product }: { product: ProductPageData }) {
  const related = await getRelatedProducts(product, 4);
  return (
    <section className="py-14 sm:py-20" aria-label="Les autres aventures">
      <div className="container-shell">
        {related.length > 0 && (
          <>
            <SectionHeading eyebrow="Pour continuer l'aventure" title="Vous aimerez aussi" href="/boutique" linkLabel="Toute la boutique" />
            <ProductGrid products={related} />
          </>
        )}

        <div className="mt-10 grid gap-6 rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--landing-accent,var(--brand-honey))_30%,white)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">
              <Sparkles className="size-3.5" aria-hidden /> Une nouvelle aventure chaque semaine
            </p>
            <h2 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">Ne manquez pas la prochaine</h2>
            <p className="mt-2 text-ink-soft">Chasses au trésor, cahiers d&apos;activités, kits de fête : recevez les nouveautés avant tout le monde, ou explorez toute la collection dès maintenant.</p>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/boutique">Voir toutes les aventures <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
          <NewsletterForm source="landing-product" compact />
        </div>
      </div>
    </section>
  );
}
