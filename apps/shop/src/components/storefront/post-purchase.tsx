import { MessageSquareHeart, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { getBestsellers, productCardSelect, type ProductCardData } from "@/lib/catalog";
import { ProductGrid } from "./product-card";
import { NewsletterForm } from "./newsletter-form";

/**
 * Après l'achat : produits complémentaires (même catégorie que les articles achetés,
 * sinon meilleures ventes), newsletter si pas abonné, invitation à donner son avis.
 */
export async function PostPurchase({ purchasedProductIds, email }: { purchasedProductIds: string[]; email: string }) {
  const purchased = purchasedProductIds.length
    ? await prisma.product.findMany({ where: { id: { in: purchasedProductIds } }, select: { id: true, categoryId: true, universe: true } })
    : [];
  const categoryIds = [...new Set(purchased.map((p) => p.categoryId).filter((c): c is string => !!c))];
  const exclude = new Set(purchasedProductIds);

  let related: ProductCardData[] = categoryIds.length
    ? await prisma.product.findMany({ where: { status: "PUBLISHED", id: { notIn: [...exclude] }, categoryId: { in: categoryIds } }, orderBy: { salesCount: "desc" }, take: 3, select: productCardSelect })
    : [];
  if (related.length < 3) {
    const best = (await getBestsellers(12)).filter((p) => !exclude.has(p.id) && !related.some((r) => r.id === p.id));
    related = [...related, ...best].slice(0, 3);
  }

  const subscribed = email ? await prisma.newsletterSubscriber.findFirst({ where: { email: email.toLowerCase(), status: "CONFIRMED" }, select: { id: true } }) : null;

  return (
    <div className="mt-14 space-y-12">
      {related.length > 0 && (
        <section aria-labelledby="next-adventure-title">
          <div className="mb-6 text-center">
            <p className="inline-flex items-center gap-1 rounded-full bg-honey-light px-3 py-1 text-xs font-bold uppercase tracking-wide text-honey-dark"><Sparkles className="size-3.5" /> Et pour la prochaine aventure ?</p>
            <h2 id="next-adventure-title" className="mt-3 font-heading text-3xl font-bold">Les familles qui ont pris ce kit aiment aussi</h2>
            <p className="mt-2 text-ink-soft">Livraison immédiate, comme votre commande : parfait pour les prochaines vacances ou un anniversaire.</p>
          </div>
          <ProductGrid products={related} className="lg:grid-cols-3 xl:grid-cols-3" />
        </section>
      )}

      {!subscribed && (
        <section className="rounded-[var(--radius-card)] bg-ink p-6 text-cream sm:p-8" aria-labelledby="post-newsletter-title">
          <h2 id="post-newsletter-title" className="font-heading text-2xl font-bold">Recevez les nouvelles aventures avant tout le monde</h2>
          <p className="mt-1 text-sm text-cream/80">Une nouveauté chaque semaine, des idées d&apos;activités et des offres réservées aux abonnés. Désinscription en un clic.</p>
          <NewsletterForm source="post-purchase" compact className="mt-4" />
        </section>
      )}

      <section className="flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-white/70 p-5" aria-labelledby="review-invite-title">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lavender-light text-lavender-dark"><MessageSquareHeart className="size-6" /></span>
        <div>
          <h2 id="review-invite-title" className="font-heading text-lg font-bold">Votre avis compte</h2>
          <p className="mt-1 text-sm text-ink-soft">Une fois l&apos;aventure vécue, revenez sur la fiche du produit pour partager votre expérience : votre avis, vérifié comme achat réel, aide d&apos;autres parents à choisir.</p>
        </div>
      </section>
    </div>
  );
}
