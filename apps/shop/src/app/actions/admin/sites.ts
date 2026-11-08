"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission, requireAdminUser } from "@/lib/auth/session";
import { fail, handleActionError, succeed, type ActionResult } from "@/lib/admin/action-result";
import { ADMIN_SITE_COOKIE } from "@/lib/sites/constants";
import { revalidateSites } from "@/lib/sites";
import { createSite, deleteSite, saveAudience, SiteAdminError, updateSite } from "@/lib/sites/admin";

function handle(e: unknown): ActionResult<never> {
  if (e instanceof SiteAdminError) return fail(e.message, e.field ? { [e.field]: [e.message] } : undefined);
  return handleActionError(e);
}

function refresh() {
  revalidateSites();
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

/** Univers sélectionné dans l'admin (« all » = tous). Mémorisé dans un cookie. */
export async function setAdminSiteAction(slug: string): Promise<ActionResult> {
  await requireAdminUser();
  const value = z.string().max(60).regex(/^[a-z0-9-]+$/).parse(slug);
  if (value !== "all" && !(await prisma.site.findUnique({ where: { slug: value }, select: { id: true } }))) return fail("Univers inconnu");
  (await cookies()).set(ADMIN_SITE_COOKIE, value, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/admin", "layout");
  return succeed(undefined);
}

export async function saveSiteAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const user = await assertPermission("settings:write");
    const site = id ? await updateSite(prisma, id, raw) : await createSite(prisma, raw);
    await audit({ userId: user.id, action: id ? "site.update" : "site.create", entity: "site", entityId: site.id, data: { slug: site.slug, domains: site.domains, status: site.status } });
    refresh();
    return succeed({ id: site.id, slug: site.slug });
  } catch (e) { return handle(e); }
}

export async function deleteSiteAction(id: string): Promise<ActionResult> {
  try {
    const user = await assertPermission("settings:write");
    await deleteSite(prisma, id);
    await audit({ userId: user.id, action: "site.delete", entity: "site", entityId: id });
    const jar = await cookies();
    if (jar.get(ADMIN_SITE_COOKIE)) jar.set(ADMIN_SITE_COOKIE, "all", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    refresh();
    return succeed(undefined);
  } catch (e) { return handle(e); }
}

export async function saveAudienceAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertPermission("settings:write");
    const a = await saveAudience(prisma, id, raw);
    await audit({ userId: user.id, action: id ? "audience.update" : "audience.create", entity: "audience", entityId: a.id });
    refresh();
    return succeed({ id: a.id });
  } catch (e) { return handle(e); }
}
