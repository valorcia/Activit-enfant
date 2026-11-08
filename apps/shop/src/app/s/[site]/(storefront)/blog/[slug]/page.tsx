import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBlogPostBySlug } from "@/lib/blog";
import { getSetting } from "@/lib/settings";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { JsonLd } from "@/components/storefront/json-ld";
import { Markdown } from "@/components/markdown";
import { ProductGrid } from "@/components/storefront/product-card";
import { SectionHeading } from "@/components/storefront/section-heading";
import { formatDate, stripMarkdown, truncate } from "@/lib/utils";
import { siteFromParams, siteUrl, getSites } from "@/lib/sites";

export const revalidate = 300;

export async function generateStaticParams({ params }: { params: { site: string } }) {
  const site = (await getSites()).find((s) => s.slug === params.site);
  if (!site) return [];
  const posts = await prisma.blogPost.findMany({ where: { siteId: site.id, status: "PUBLISHED" }, select: { slug: true }, take: 200 });
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ site: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const data = await getBlogPostBySlug(site.id, slug);
  if (!data) return { title: "Article introuvable" };
  const { post } = data;
  const description = post.seoDescription ?? post.excerpt ?? truncate(stripMarkdown(post.content), 160);
  return {
    title: post.seoTitle ?? post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.seoTitle ?? post.title, description, publishedTime: post.publishedAt?.toISOString(), images: post.coverImageUrl ? [post.coverImageUrl] : undefined },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ site: string; slug: string }> }) {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const base = siteUrl(site);
  const absoluteUrl = (p: string) => (p.startsWith("http") ? p : `${base}${p}`);
  const data = await getBlogPostBySlug(site.id, slug);
  if (!data) notFound();
  const { post, related } = data;
  const brand = await getSetting("brand", site);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.coverImageUrl ? [absoluteUrl(post.coverImageUrl)] : undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: post.author?.name ?? brand.name },
    publisher: { "@type": "Organization", name: brand.name, logo: brand.logoUrl ? { "@type": "ImageObject", url: absoluteUrl(brand.logoUrl) } : undefined },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };
  return (
    <article className="container-shell py-10 sm:py-14">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.title }]} />
      <header className="mx-auto mt-6 max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{formatDate(post.publishedAt)}{post.author?.name ? ` · ${post.author.name}` : ""}</p>
        <h1 className="mt-3 font-heading text-3xl font-bold text-balance sm:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-lg text-ink-soft text-pretty">{post.excerpt}</p>}
      </header>
      {post.coverImageUrl && (
        <div className="relative mx-auto mt-8 aspect-[16/9] max-w-4xl overflow-hidden rounded-[var(--radius-card)] shadow-card">
          <Image src={post.coverImageUrl} alt="" fill sizes="(max-width: 1024px) 100vw, 896px" className="object-cover" priority />
        </div>
      )}
      <div className="mx-auto mt-10 max-w-3xl">
        <Markdown content={post.content} className="text-lg" />
        {post.tags.length > 0 && <p className="mt-8 text-sm text-ink-muted">{post.tags.map((t) => `#${t}`).join("  ")}</p>}
      </div>
      {related.length > 0 && (
        <section className="mt-16">
          <SectionHeading title="Les kits dont on parle dans cet article" />
          <ProductGrid products={related} className="mt-6" />
        </section>
      )}
    </article>
  );
}
