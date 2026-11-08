"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { slugify } from "@/lib/utils";
import { adminDefaultSiteId } from "@/lib/sites";

export const staticPageSchema = z.object({
  title: z.string().min(2).max(120),
  slug: z.string().max(80).optional().nullable(),
  content: z.string().max(200000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  showInFooter: z.coerce.boolean().default(true),
  position: z.coerce.number().int().min(0).default(0),
  seoTitle: z.string().max(70).optional().nullable(),
  seoDescription: z.string().max(170).optional().nullable(),
});

export type PageResult = { ok: true; id: string } | { ok: false; error: string; fields?: Record<string, string> };

export async function saveStaticPageAction(id: string | null, raw: unknown): Promise<PageResult> {
  try {
    const user = await assertPermission("pages:write");
    const parsed = staticPageSchema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[String(i.path[0] ?? "_")] = i.message;
      return { ok: false, error: "Formulaire invalide", fields };
    }
    const d = parsed.data;
    const slug = slugify(d.slug || d.title) || "page";
    const siteId = id ? (await prisma.staticPage.findUniqueOrThrow({ where: { id }, select: { siteId: true } })).siteId : await adminDefaultSiteId();
    const existing = await prisma.staticPage.findFirst({ where: { siteId, slug }, select: { id: true } });
    if (existing && existing.id !== id) return { ok: false, error: "Ce slug existe déjà", fields: { slug: "Slug déjà utilisé" } };
    const data = { title: d.title, slug, siteId, content: d.content, status: d.status, showInFooter: d.showInFooter, position: d.position, seoTitle: d.seoTitle ?? null, seoDescription: d.seoDescription ?? null };
    const page = id ? await prisma.staticPage.update({ where: { id }, data }) : await prisma.staticPage.create({ data });
    await audit({ userId: user.id, action: id ? "page.update" : "page.create", entity: "staticPage", entityId: page.id, data: { slug, status: d.status } });
    revalidateTag("pages", "max");
    revalidatePath("/admin/pages");
    revalidatePath(`/pages/${slug}`);
    return { ok: true, id: page.id };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}

export async function deleteStaticPageAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await assertPermission("pages:write");
    await prisma.staticPage.delete({ where: { id } });
    await audit({ userId: user.id, action: "page.delete", entity: "staticPage", entityId: id });
    revalidateTag("pages", "max");
    revalidatePath("/admin/pages");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}
