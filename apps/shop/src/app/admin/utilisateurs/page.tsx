import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { UserManager } from "@/components/admin/ops-user-manager";

export const metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requirePermission("users:write");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true } });
  return (
    <div>
      <AdminPageHeader title="Utilisateurs" description="Comptes du back-office et rôles : Administrateur (tout), Éditeur (catalogue, blog, pages), Marketing (promos, avis, newsletter, apparence), Support (commandes, clients, avis)." />
      <UserManager meId={me.id} users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }))} />
    </div>
  );
}
