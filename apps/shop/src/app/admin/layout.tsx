import { getAdminUser } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSetting } from "@/lib/settings";
import { getAdminSite, getSites, siteUrl } from "@/lib/sites";

export const metadata = { title: { default: "Administration", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  // La page de connexion n'a pas de coque (l'utilisateur n'est pas authentifié)
  if (!user) return <>{children}</>;
  const [brand, sites, adminSite] = await Promise.all([getSetting("brand"), getSites(), getAdminSite()]);
  const options = sites.map((s) => ({ slug: s.slug, name: s.name, status: s.status, url: s.status === "ACTIVE" && (s.primaryDomain || s.domains[0]) ? siteUrl(s) : `/?site=${s.slug}` }));
  return <AdminShell user={user} brandName={brand.name} sites={options} currentSite={adminSite?.slug ?? "all"}>{children}</AdminShell>;
}
