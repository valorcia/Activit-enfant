import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requirePermission } from "@/lib/auth/session";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { SitesManager } from "@/components/admin/ops-sites-manager";
import { PRESETS } from "@/lib/sites/presets";
import { siteBaseUrl } from "@/lib/sites/host";

export const metadata = { title: "Univers & domaines" };
export const dynamic = "force-dynamic";

export default async function UniversPage() {
  await requirePermission("settings:write");
  const [sites, audiences] = await Promise.all([
    prisma.site.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: { audience: { select: { name: true } }, _count: { select: { products: true, categories: true, orders: true } } },
    }),
    prisma.audience.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { sites: true, socialAccounts: true } } } }),
  ]);
  const hubDomain = process.env.HUB_DOMAIN?.trim() || null;
  return (
    <div>
      <AdminPageHeader
        title="Univers & domaines"
        description="La plateforme regroupe des audiences (Familles & enfants, Maison & jardin…) et, dans chacune, des univers : des boutiques avec leur nom, leurs domaines, leur thème, leur ton et leur catalogue."
      />
      <SitesManager
        sites={sites.map((s) => ({
          id: s.id, slug: s.slug, name: s.name, audienceId: s.audienceId, audienceName: s.audience.name, preset: s.preset, status: s.status,
          domains: s.domains, primaryDomain: s.primaryDomain, isDefault: s.isDefault,
          url: siteBaseUrl(s, env.appUrl), previewUrl: `/?site=${s.slug}`, hubUrl: hubDomain ? `https://${s.slug}.${hubDomain}` : null,
          counts: s._count,
        }))}
        audiences={audiences.map((a) => ({ id: a.id, slug: a.slug, name: a.name, description: a.description, color: a.color, siteCount: a._count.sites, accountCount: a._count.socialAccounts }))}
        presets={Object.values(PRESETS).map((p) => ({ id: p.id, label: p.label, description: p.description, categories: p.starterCategories.map((c) => c.name) }))}
      />
      <AdminCard title="Brancher un domaine" className="mt-6" description="Chaque univers peut avoir plusieurs domaines (ex. avec et sans www). Le détail pas à pas est dans docs/DOMAINES.md.">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>Achetez le domaine, puis ajoutez-le au projet Vercel de la boutique (Settings → Domains), avec la variante <code>www</code>.</li>
          <li>Chez le registraire : enregistrement <code>A</code> de l&apos;apex vers <code>76.76.21.21</code> et <code>CNAME www</code> vers <code>cname.vercel-dns.com</code> (ou les valeurs affichées par Vercel).</li>
          <li>Ici : saisissez le domaine dans l&apos;univers, choisissez-le comme domaine principal, puis passez l&apos;univers en statut « Actif ». Un univers « Test » est servi sur ses domaines, via l&apos;aperçu <code>/?site=slug</code>{hubDomain ? <> et sur <code>slug.{hubDomain}</code></> : null}, sans jamais être indexé.</li>
          <li>Meta : vérifiez le domaine dans le Business Manager (Brand Safety → Domaines), avec la balise méta à coller dans Apparence → SEO de cet univers, puis associez le pixel de l&apos;audience.</li>
          <li>Stripe : rien à faire, le libellé bancaire suit le nom de l&apos;univers et les URLs de retour son domaine.</li>
        </ol>
      </AdminCard>
    </div>
  );
}
