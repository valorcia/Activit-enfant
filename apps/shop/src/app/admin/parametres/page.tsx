import { requirePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { isStripeConfigured, isStripeLiveMode } from "@/lib/stripe";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/ops-settings-form";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePermission("settings:write");
  const settings = await getSettings();
  const integration = {
    stripeConfigured: isStripeConfigured(),
    stripeLive: isStripeLiveMode(),
    stripeKeyPresent: Boolean(env.stripeSecretKey),
    webhookSecretPresent: Boolean(env.stripeWebhookSecret),
    publishableKeyPresent: Boolean(env.stripePublishableKey),
    storageDriver: env.storageDriver,
    s3Configured: Boolean(env.s3.bucket && env.s3.accessKeyId && env.s3.secretAccessKey),
    emailDriver: env.emailDriver,
    resendConfigured: Boolean(env.resendApiKey),
    cronSecretPresent: Boolean(env.cronSecret),
    appUrl: env.appUrl,
  };
  return (
    <div>
      <AdminPageHeader title="Paramètres" description="Commerce, SEO, analytics et état des intégrations. Les clés secrètes restent dans les variables d'environnement et ne sont jamais affichées." />
      <SettingsForm commerce={settings.commerce} seo={settings.seo} analytics={settings.analytics} integration={integration} />
    </div>
  );
}
