import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { roleCan, type Permission } from "@/lib/auth/permissions";
import type { Role } from "@prisma/client";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return { id: session.user.id, email: session.user.email ?? "", name: session.user.name ?? null, role: session.user.role };
}

/** Redirige vers la connexion si non authentifié. */
export async function requireAdminUser(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/connexion");
  return user;
}

/** Redirige vers une page d'erreur si la permission manque. */
export async function requirePermission(permission: Permission): Promise<AdminUser> {
  const user = await requireAdminUser();
  if (!roleCan(user.role, permission)) redirect("/admin/acces-refuse");
  return user;
}

/** Pour les server actions : lève une erreur plutôt qu'une redirection. */
export async function assertPermission(permission: Permission): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) throw new Error("Authentification requise");
  if (!roleCan(user.role, permission)) throw new Error("Permission insuffisante");
  return user;
}
