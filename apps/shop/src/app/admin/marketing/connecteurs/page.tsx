import { getSecrets } from "@/lib/integrations/secrets";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, AdminCard } from "@/components/admin/page-header";
import { MarketingNav } from "@/components/admin/ops-marketing-nav";
import { SocialConnectors } from "@/components/admin/ops-social-connectors";
import { connectors } from "@/lib/social";
import { getSetting } from "@/lib/settings";
import { Alert } from "@/components/ui/misc";

export const metadata = { title: "Connecteurs sociaux" };
export const dynamic = "force-dynamic";

export default async function ConnectorsPage({ searchParams }: { searchParams: Promise<{ connecte?: string; comptes?: string; erreur?: string }> }) {
  await requirePermission("marketing:write");
  const sp = await searchParams;
  const tokens = await getSecrets(["meta.capiToken", "tiktok.eventsToken"]);
  const [audiences, accounts, analytics] = await Promise.all([
    prisma.audience.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.socialAccount.findMany({ where: { isActive: true }, orderBy: [{ provider: "asc" }, { kind: "asc" }, { name: "asc" }] }),
    getSetting("analytics"),
  ]);
  return (
    <div>
      <AdminPageHeader title="Connecteurs sociaux" description="Autorisez l'application à publier sur vos comptes et à lire les dépenses publicitaires. Rattachez chaque page ou compte à une audience : l'autopilote publie un produit sur les comptes de l'audience de son univers (puis sur les comptes communs). Les jetons sont chiffrés en base." />
      <MarketingNav />
      {sp.connecte && <Alert variant="success" className="mb-4">Connexion {sp.connecte} réussie : {sp.comptes ?? 0} compte(s) détecté(s).</Alert>}
      {sp.erreur && <Alert variant="danger" className="mb-4">{sp.erreur === "non-configure" ? "Application non configurée : renseignez l'identifiant et la clé secrète de l'application dans Paramètres → Intégrations." : `Connexion refusée : ${sp.erreur}`}</Alert>}
      <SocialConnectors
        accounts={accounts.map((a) => ({ id: a.id, provider: a.provider, kind: a.kind, name: a.name, username: a.username, avatarUrl: a.avatarUrl, needsReconnect: a.needsReconnect, tokenExpiresAt: a.tokenExpiresAt?.toISOString() ?? null, parentId: a.parentId, audienceId: a.audienceId }))}
        audiences={audiences}
        configured={{ META: await connectors.META.isConfigured(), TIKTOK: await connectors.TIKTOK.isConfigured() }}
        conversions={{ meta: Boolean(analytics.metaPixelId && (tokens["meta.capiToken"] || analytics.metaCapiToken)), tiktok: Boolean(analytics.tiktokPixelId && (tokens["tiktok.eventsToken"] || analytics.tiktokEventsToken)) }}
      />
      <AdminCard title="Ce que permettent (et ne permettent pas) les API" className="mt-6">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>Un compte publicitaire Meta ou TikTok <strong>ne peut pas être créé par API</strong> : créez votre Business Manager (business.facebook.com) ou TikTok for Business, puis cliquez sur Connecter.</li>
          <li>Publication organique (Page Facebook, Instagram professionnel, TikTok) et lecture des dépenses : via les API officielles, après validation de l'application par Meta (permissions <code>pages_manage_posts</code>, <code>instagram_content_publish</code>, <code>ads_read</code>) et audit TikTok (Content Posting API). Tant que l'app n'est pas validée, les publications TikTok restent privées et seuls les comptes testeurs fonctionnent chez Meta.</li>
          <li><strong>Mode dégradé toujours disponible</strong> : génération des textes, bouton Copier, téléchargement de l'image, lien direct vers Meta Business Suite ou TikTok, saisie manuelle des dépenses par jour. L'attribution des ventes par UTM et le tableau de rentabilité fonctionnent sans aucune connexion.</li>
          <li>Les créations de campagnes payantes (budgets, ciblages) se font dans le Gestionnaire de publicités ; ici vous liez la campagne externe pour importer ses dépenses.</li>
        </ul>
      </AdminCard>
    </div>
  );
}
