import { getAdminUser } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSetting } from "@/lib/settings";

export const metadata = { title: { default: "Administration", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  // La page de connexion n'a pas de coque (l'utilisateur n'est pas authentifié)
  if (!user) return <>{children}</>;
  const brand = await getSetting("brand");
  return <AdminShell user={user} brandName={brand.name}>{children}</AdminShell>;
}
