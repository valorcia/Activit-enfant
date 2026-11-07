import { BadgeCheck } from "lucide-react";
import { Stars } from "@/components/ui/misc";
import type { ProductPageData } from "@/lib/catalog";
import { formatDate } from "@/lib/utils";
import { ReviewForm } from "./review-form";

/** Avis approuvés uniquement (modérés). Jamais de faux avis. */
export function ProductReviews({ product }: { product: ProductPageData }) {
  const reviews = product.reviews;
  return (
    <section id="avis" className="bg-white py-14 sm:py-20" aria-labelledby="reviews-title">
      <div className="container-shell grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 id="reviews-title" className="font-heading text-3xl font-bold sm:text-4xl">Avis des familles</h2>
          {product.ratingAvg != null && product.reviewCount > 0 ? (
            <p className="mt-2 flex items-center gap-2 text-ink-soft"><Stars rating={product.ratingAvg} size="lg" /> <span className="font-bold text-ink">{product.ratingAvg.toFixed(1)} / 5</span> · {product.reviewCount} avis vérifiés par notre équipe</p>
          ) : (
            <p className="mt-2 text-ink-soft">Aucun avis publié pour le moment. Soyez la première famille à partager votre expérience !</p>
          )}
          {reviews.length > 0 && (
            <ul className="mt-8 space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-3xl bg-cream p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Stars rating={r.rating} size="sm" />
                      {r.isVerifiedPurchase && <span className="inline-flex items-center gap-1 rounded-full bg-sage-light px-2 py-0.5 text-[11px] font-bold text-sage-dark"><BadgeCheck className="size-3.5" aria-hidden /> Achat vérifié</span>}
                    </div>
                    <time dateTime={r.createdAt.toISOString()} className="text-xs text-ink-muted">{formatDate(r.createdAt)}</time>
                  </div>
                  {r.title && <p className="mt-2 font-heading text-lg font-semibold">{r.title}</p>}
                  <p className="mt-1 whitespace-pre-line text-ink-soft">{r.body}</p>
                  <p className="mt-3 text-sm font-bold">— {r.authorName}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div><ReviewForm productId={product.id} /></div>
      </div>
    </section>
  );
}
