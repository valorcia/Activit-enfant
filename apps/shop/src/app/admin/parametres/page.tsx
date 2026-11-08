import { requirePermission } from "@/lib/auth/session";
import { getSettings, publicAnalytics, saveSetting } from "@/lib/settings";
import { env } from "@/lib/env";
import { canEncryptSecrets, getSecretStatus, setSecret } from "@/lib/integrations/secrets";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/ops-settings-form";
import { getAdminSite, getDefaultSite } from "@/lib/sites";
import { SiteTargetNotice } from "@/components/admin/site-target-notice";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

/**
 * Migration unique : les jetons Conversions API autrefois saisis dans Analytics
 * rejoignent le coffre chiffré des intégrations, puis sont retirés des paramètres.
 */
async function migrateLegacyTokens(userId: string) {
  if (!canEncryptSecrets()) return;
  const { analytics } = await getSettings();
  if (!analytics.metaCapiToken && !analytics.tiktokEventsToken) return;
  const statuses = await getSecretStatus();
  const inDb = (k: string) => statuses.some((s) => s.key === k && s.source === "database");
  if (analytics.metaCapiToken && !inDb("meta.capiToken")) await setSecret("meta.capiToken", analytics.metaCapiToken, { userId, actor: "migration" });
  if (analytics.tiktokEventsToken && !inDb("tiktok.eventsToken")) await setSecret("tiktok.eventsToken", analytics.tiktokEventsToken, { userId, actor: "migration" });
  await saveSetting("analytics", { ...analytics, metaCapiToken: null, tiktokEventsToken: null }, (await getDefaultSite()).id);
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const user = await requirePermission("settings:write");
  await migrateLegacyTokens(user.id).catch((e) => console.warn("[parametres] migration des jetons impossible", e instanceof Error ? e.message : e));
  const adminSite = await getAdminSite();
  const target = adminSite ?? (await getDefaultSite());
  const [settings, statuses, { onglet }] = await Promise.all([getSettings(target), getSecretStatus(), searchParams]);
  const integrations = {
    statuses,
    canEncrypt: canEncryptSecrets(),
    infra: {
      storageDriver: env.storageDriver,
      s3Configured: Boolean(env.s3.bucket && env.s3.accessKeyId && env.s3.secretAccessKey),
      cronSecretPresent: Boolean(env.cronSecret),
      appUrl: env.appUrl,
    },
  };
  return (
    <div>
      <AdminPageHeader title="Paramètres" description="Commerce, SEO, analytics et clés d'intégration (Stripe, emails, IA, réseaux sociaux, vidéo)." />
      <SiteTargetNotice site={target} explicit={!!adminSite} scope="settings" />
      <SettingsForm commerce={settings.commerce} seo={settings.seo} analytics={publicAnalytics(settings.analytics)} integrations={integrations} defaultTab={["commerce", "seo", "analytics", "integration"].includes(onglet ?? "") ? onglet : "commerce"} />
    </div>
  );
}
