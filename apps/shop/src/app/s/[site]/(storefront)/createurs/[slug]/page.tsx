import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { Lightbulb } from "lucide-react";
import { prisma } from "@/lib/db";
import { CATALOG_TAG, productCardSelect } from "@/lib/catalog";
import { siteAbsoluteUrl, siteFromParams } from "@/lib/sites";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { ProductCard } from "@/components/storefront/product-card";
import { truncate } from "@/lib/utils";

export const revalidate = 300;

type Params = { params: Promise<{ site: string; slug: string }> };

/** Page publique d'une créatrice : pseudo, présentation et ses tutoriels en vente dans l'univers. */
const getCreatorPage = (siteId: string, slug: string) =>
  unstable_cache(
    async () => {
      const creator = await prisma.creator.findFirst({ where: { slug, status: "ACTIVE", publicName: { not: null } }, select: { id: true, publicName: true, bio: true, photoUrl: true, slug: true } });
      if (!creator) return null;
      const products = await prisma.product.findMany({ where: { creatorId: creator.id, siteId, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: productCardSelect });
      return { creator, products };
    },
    ["creator-page", siteId, slug],
    { tags: [CATALOG_TAG], revalidate: 300 },
  )();

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const data = await getCreatorPage(site.id, slug);
  if (!data) return {};
  const title = `Les idées de ${data.creator.publicName}`;
  return {
    title,
    description: data.creator.bio ? truncate(data.creator.bio, 160) : `Les tutoriels d'activités imaginés par ${data.creator.publicName}.`,
    alternates: { canonical: siteAbsoluteUrl(site, `/createurs/${slug}`) },
    robots: data.products.length ? undefined : { index: false, follow: true },
    openGraph: { title, images: data.creator.photoUrl ? [data.creator.photoUrl] : undefined },
  };
}

export default async function CreatorPublicPage({ params }: Params) {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const data = await getCreatorPage(site.id, slug);
  if (!data) notFound();
  const { creator, products } = data;
  return (
    <div className="container-shell py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Boutique", href: "/boutique" }, { label: creator.publicName ?? "" }]} className="mb-6" />
      <header className="card-soft flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left">
        <div className="size-24 shrink-0 overflow-hidden rounded-full bg-honey-light">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {creator.photoUrl ? <img src={creator.photoUrl} alt="" className="size-full object-cover" /> : <Lightbulb className="m-7 size-10 text-honey-dark" />}
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">Créatrice</p>
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">{creator.publicName}</h1>
          {creator.bio && <p className="mt-2 max-w-2xl whitespace-pre-line text-ink-soft">{creator.bio}</p>}
        </div>
      </header>
      <h2 className="mt-10 font-heading text-2xl font-bold">Ses tutoriels</h2>
      {products.length === 0 ? (
        <p className="mt-3 text-ink-soft">Ses premières idées arrivent bientôt dans la boutique.</p>
      ) : (
        <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
        </ul>
      )}
    </div>
  );
}
