import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { siteFromParams, getSites } from "@/lib/sites";
import { getPublishedPage } from "@/lib/pages";
import { stripMarkdown, truncate } from "@/lib/utils";
import { StaticPageView } from "@/components/storefront/static-page-view";

export const revalidate = 600;

export async function generateStaticParams({ params }: { params: { site: string } }) {
  const site = (await getSites()).find((s) => s.slug === params.site);
  if (!site) return [];
  const rows = await prisma.staticPage.findMany({ where: { siteId: site.id, status: "PUBLISHED" }, select: { slug: true } });
  return rows.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ site: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const page = await getPublishedPage(site.id, slug);
  if (!page) return {};
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? truncate(stripMarkdown(page.content), 160), alternates: { canonical: `/pages/${page.slug}` } };
}

export default async function StaticPage({ params }: { params: Promise<{ site: string; slug: string }> }) {
  const { slug } = await params;
  const site = await siteFromParams(params);
  const page = await getPublishedPage(site.id, slug);
  if (!page) notFound();
  return <StaticPageView page={page} />;
}
