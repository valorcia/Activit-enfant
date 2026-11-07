import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getPublishedPage } from "@/lib/pages";
import { stripMarkdown, truncate } from "@/lib/utils";
import { StaticPageView } from "@/components/storefront/static-page-view";

export const revalidate = 600;

export async function generateStaticParams() {
  const rows = await prisma.staticPage.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
  return rows.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return {};
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? truncate(stripMarkdown(page.content), 160), alternates: { canonical: `${env.appUrl}/pages/${page.slug}` } };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  return <StaticPageView page={page} />;
}
