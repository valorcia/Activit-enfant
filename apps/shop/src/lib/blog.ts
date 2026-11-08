import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { productCardSelect } from "@/lib/catalog";

export const BLOG_TAG = "blog";

const publishedWhere = { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };

export const getBlogPosts = unstable_cache(
  async (siteId: string, page = 1, perPage = 12) => {
    const [items, total] = await Promise.all([
      prisma.blogPost.findMany({ where: { siteId, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, skip: (page - 1) * perPage, take: perPage, select: { id: true, slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true, tags: true, author: { select: { name: true } } } }),
      prisma.blogPost.count({ where: { siteId, status: "PUBLISHED" } }),
    ]);
    return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
  },
  ["blog-posts"],
  { tags: [BLOG_TAG], revalidate: 300 },
);

export const getLatestBlogPosts = unstable_cache(
  async (siteId: string, limit = 3) => prisma.blogPost.findMany({ where: { siteId, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: limit, select: { id: true, slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true } }),
  ["blog-latest"],
  { tags: [BLOG_TAG], revalidate: 300 },
);

export const getBlogPostBySlug = (siteId: string, slug: string) =>
  unstable_cache(
    async () => {
      const post = await prisma.blogPost.findFirst({ where: { siteId, slug, status: "PUBLISHED" }, include: { author: { select: { name: true } } } });
      if (!post) return null;
      const related = post.relatedProductIds.length
        ? await prisma.product.findMany({ where: { id: { in: post.relatedProductIds }, siteId, status: "PUBLISHED" }, select: productCardSelect })
        : [];
      return { post, related };
    },
    ["blog-post", siteId, slug],
    { tags: [BLOG_TAG, `blog:${slug}`], revalidate: 300 },
  )();

void publishedWhere;
