"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";

const userSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  name: z.string().max(80).optional().nullable(),
  role: z.enum(["ADMIN", "EDITOR", "MARKETING", "SUPPORT"]),
  isActive: z.coerce.boolean().default(true),
  password: z.string().min(10, "10 caractères minimum").max(200).optional().or(z.literal("")),
});

export type UserResult = { ok: true; id: string } | { ok: false; error: string; fields?: Record<string, string> };

async function adminCount(excludeId?: string) {
  return prisma.user.count({ where: { role: "ADMIN", isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

export async function saveUserAction(id: string | null, raw: unknown): Promise<UserResult> {
  try {
    const me = await assertPermission("users:write");
    const parsed = userSchema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[String(i.path[0] ?? "_")] = i.message;
      return { ok: false, error: "Formulaire invalide", fields };
    }
    const d = parsed.data;
    if (!id && !d.password) return { ok: false, error: "Mot de passe requis", fields: { password: "Requis pour un nouveau compte" } };
    const existing = await prisma.user.findUnique({ where: { email: d.email } });
    if (existing && existing.id !== id) return { ok: false, error: "Email déjà utilisé", fields: { email: "Déjà utilisé" } };
    if (id === me.id && d.role !== "ADMIN") return { ok: false, error: "Vous ne pouvez pas retirer votre propre rôle administrateur" };
    if (id === me.id && !d.isActive) return { ok: false, error: "Vous ne pouvez pas désactiver votre propre compte" };
    if (id) {
      const target = await prisma.user.findUnique({ where: { id } });
      if (target?.role === "ADMIN" && target.isActive && (d.role !== "ADMIN" || !d.isActive) && (await adminCount(id)) === 0) {
        return { ok: false, error: "Impossible : il doit rester au moins un administrateur actif" };
      }
    }
    const data = { email: d.email, name: d.name ?? null, role: d.role, isActive: d.isActive, ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}) };
    const user = id ? await prisma.user.update({ where: { id }, data }) : await prisma.user.create({ data: { ...data, passwordHash: data.passwordHash as string } });
    await audit({ userId: me.id, action: id ? "user.update" : "user.create", entity: "user", entityId: user.id, data: { role: d.role, isActive: d.isActive } });
    revalidatePath("/admin/utilisateurs");
    return { ok: true, id: user.id };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}

export async function deleteUserAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await assertPermission("users:write");
    if (id === me.id) return { ok: false, error: "Vous ne pouvez pas supprimer votre propre compte" };
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return { ok: false, error: "Utilisateur introuvable" };
    if (target.role === "ADMIN" && target.isActive && (await adminCount(id)) === 0) return { ok: false, error: "Il doit rester au moins un administrateur actif" };
    await prisma.user.delete({ where: { id } });
    await audit({ userId: me.id, action: "user.delete", entity: "user", entityId: id, data: { email: target.email } });
    revalidatePath("/admin/utilisateurs");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}
