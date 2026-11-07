"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { slugify } from "@/lib/utils";

const stringList = z.preprocess((v) => (typeof v === "string" ? v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : v ?? []), z.array(z.string().max(60)).max(30));
const optionalDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional());

export const blogPostSchema = z.object({
  title: z.string().min(2).max(160),
  slug: z.string().max(120).optional().nullable(),
  excerpt: z.string().max(400).optional().nullable(),
  content: z.string().min(1).max(100000),
  coverImageUrl: z.string().max(500).optional().nullable(),
  tags: stringList.optional().default([]),
  seoTitle: z.string().max(70).optional().nullable(),
  seoDescription: z.string().max(170).optional().nullable(),
  relatedProductIds: z.array(z.string()).optional().default([]),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  scheduledAt: optionalDate,
}).refine((p) => p.status !== "SCHEDULED" || !!p.scheduledAt, { path: ["scheduledAt"], message: "Date de publication requise" });

export type BlogResult = { ok: true; id: string } | { ok: false; error: string; fields?: Record<string, string> };

async function uniquePostSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "article";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const ex = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
    if (!ex || ex.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export async function saveBlogPostAction(id: string | null, raw: unknown): Promise<BlogResult> {
  try {
    const user = await assertPermission("blog:write");
    const parsed = blogPostSchema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[String(i.path[0] ?? "_")] = i.message;
      return { ok: false, error: "Formulaire invalide", fields };
    }
    const d = parsed.data;
    const before = id ? await prisma.blogPost.findUnique({ where: { id } }) : null;
    const slug = await uniquePostSlug(d.slug || d.title, id ?? undefined);
    const data = {
      title: d.title, slug, excerpt: d.excerpt ?? null, content: d.content, coverImageUrl: d.coverImageUrl ?? null, tags: d.tags,
      seoTitle: d.seoTitle ?? null, seoDescription: d.seoDescription ?? null, relatedProductIds: d.relatedProductIds, status: d.status,
      scheduledAt: d.status === "SCHEDULED" ? d.scheduledAt ?? null : null,
      publishedAt: d.status === "PUBLISHED" ? before?.publishedAt ?? new Date() : before?.publishedAt ?? null,
    };
    const post = id ? await prisma.blogPost.update({ where: { id }, data }) : await prisma.blogPost.create({ data: { ...data, authorId: user.id } });
    await audit({ userId: user.id, action: id ? "post.update" : "post.create", entity: "blogPost", entityId: post.id, data: { slug, status: d.status } });
    revalidateTag("blog", "max");
    revalidatePath("/admin/blog");
    return { ok: true, id: post.id };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}

export async function deleteBlogPostAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await assertPermission("blog:write");
    await prisma.blogPost.delete({ where: { id } });
    await audit({ userId: user.id, action: "post.delete", entity: "blogPost", entityId: id });
    revalidateTag("blog", "max");
    revalidatePath("/admin/blog");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}
