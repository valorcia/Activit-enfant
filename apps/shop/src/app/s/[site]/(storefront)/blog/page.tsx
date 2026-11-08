import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getBlogPosts } from "@/lib/blog";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { SectionHeading } from "@/components/storefront/section-heading";
import { Pagination } from "@/components/storefront/pagination";
import { PlaceholderArt } from "@/components/storefront/placeholder-art";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog — idées d'activités et conseils pour les familles",
  description: "Idées d'activités, conseils d'organisation de chasses au trésor, anniversaires et moments en famille.",
  alternates: { canonical: "/blog" },
};

export default async function BlogIndexPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { items, pages } = await getBlogPosts(page, 12);
  return (
    <div className="container-shell py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Blog" }]} />
      <SectionHeading as="h1" eyebrow="Le blog" title="Idées, conseils et inspirations pour les familles" description="Des articles pour préparer vos chasses au trésor, animer un anniversaire ou occuper les enfants les jours de pluie." className="mt-6" />
      {items.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center text-ink-soft">Les premiers articles arrivent bientôt.</p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <article key={p.id} className="card-soft card-hover group relative flex flex-col overflow-hidden">
              <div className="relative aspect-[16/10] bg-cream-dark/30">
                {p.coverImageUrl ? <Image src={p.coverImageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <PlaceholderArt hideLabel />}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{formatDate(p.publishedAt)}</p>
                <h2 className="mt-1 font-heading text-xl font-semibold leading-snug"><Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0">{p.title}</Link></h2>
                {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{p.excerpt}</p>}
                {p.tags.length > 0 && <p className="mt-3 text-xs text-ink-muted">{p.tags.map((t) => `#${t}`).join(" ")}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} basePath="/blog" params={{}} className="mt-10" />
    </div>
  );
}
