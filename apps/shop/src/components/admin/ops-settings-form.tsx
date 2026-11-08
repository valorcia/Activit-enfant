"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField, FormSection } from "@/components/admin/form-controls";
import { UploadField } from "@/components/admin/upload-field";
import { saveSettingAction } from "@/app/actions/admin/settings";
import type { AnalyticsSettings, CommerceSettings, SeoSettings, SettingsKey } from "@/lib/schemas/settings";

export interface IntegrationState { stripeConfigured: boolean; stripeLive: boolean; stripeKeyPresent: boolean; webhookSecretPresent: boolean; publishableKeyPresent: boolean; storageDriver: string; s3Configured: boolean; emailDriver: string; resendConfigured: boolean; cronSecretPresent: boolean; appUrl: string }

function Status({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 text-sage-dark" /> : <XCircle className="mt-0.5 size-4 text-red-500" />}
      <span><span className="font-semibold">{label}</span>{detail && <span className="block text-xs text-ink-muted">{detail}</span>}</span>
    </li>
  );
}

export function SettingsForm({ commerce: c0, seo: s0, analytics: a0, integration: it }: { commerce: CommerceSettings; seo: SeoSettings; analytics: AnalyticsSettings; integration: IntegrationState }) {
  const [commerce, setCommerce] = useState(c0);
  const [seo, setSeo] = useState(s0);
  const [analytics, setAnalytics] = useState(a0);
  const [pending, start] = useTransition();
  const save = (key: SettingsKey, value: unknown) => start(async () => { const r = await saveSettingAction(key, value); r.ok ? toast.success("Enregistré") : toast.error(r.error); });
  const num = (v: string, fallback: number) => (v === "" ? fallback : Number(v));

  return (
    <Tabs defaultValue="commerce">
      <TabsList className="mb-4">
        <TabsTrigger value="commerce">Commerce</TabsTrigger>
        <TabsTrigger value="seo">SEO</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="integration">Intégrations</TabsTrigger>
      </TabsList>

      <TabsContent value="commerce">
        <div className="space-y-6">
          <FormSection title="Paiement et taxes">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Devise (ISO)" htmlFor="c-cur"><Input id="c-cur" value={commerce.currency} maxLength={3} onChange={(e) => setCommerce({ ...commerce, currency: e.target.value.toUpperCase() })} /></FormField>
              <FormField label="TVA par défaut (%)" htmlFor="c-tax"><Input id="c-tax" type="number" step="0.01" value={commerce.defaultTaxRateBp / 100} onChange={(e) => setCommerce({ ...commerce, defaultTaxRateBp: Math.round(num(e.target.value, 20) * 100) })} /></FormField>
              <FormField label="Préfixe commande" htmlFor="c-op"><Input id="c-op" value={commerce.orderPrefix} maxLength={10} onChange={(e) => setCommerce({ ...commerce, orderPrefix: e.target.value })} /></FormField>
              <FormField label="Préfixe facture" htmlFor="c-ip"><Input id="c-ip" value={commerce.invoicePrefix} maxLength={10} onChange={(e) => setCommerce({ ...commerce, invoicePrefix: e.target.value })} /></FormField>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={commerce.pricesIncludeTax} onChange={(e) => setCommerce({ ...commerce, pricesIncludeTax: e.target.checked })} className="size-4 accent-coral" /> Prix affichés TTC</label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={commerce.allowStripePromotionCodes} onChange={(e) => setCommerce({ ...commerce, allowStripePromotionCodes: e.target.checked })} className="size-4 accent-coral" /> Autoriser les codes promotionnels Stripe (en plus des codes internes)</label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={commerce.collectTermsConsent} onChange={(e) => setCommerce({ ...commerce, collectTermsConsent: e.target.checked })} className="size-4 accent-coral" /> Demander l&apos;acceptation des CGV dans Stripe Checkout (URL des CGV à renseigner dans Stripe)</label>
            <FormField label="Mention sur le droit de rétractation (affichée avant paiement)" htmlFor="c-wn"><Textarea id="c-wn" value={commerce.withdrawalNotice} maxLength={600} onChange={(e) => setCommerce({ ...commerce, withdrawalNotice: e.target.value })} className="min-h-[90px]" /></FormField>
          </FormSection>
          <FormSection title="Téléchargements">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Téléchargements max par produit acheté" htmlFor="c-dl" hint="Protection contre les téléchargements abusifs"><Input id="c-dl" type="number" min={1} max={1000} value={commerce.downloadMaxPerEntitlement} onChange={(e) => setCommerce({ ...commerce, downloadMaxPerEntitlement: num(e.target.value, 50) })} /></FormField>
              <FormField label="Validité des liens « Retrouver mes achats » (heures)" htmlFor="c-lv"><Input id="c-lv" type="number" min={1} value={commerce.downloadLinkValidityHours} onChange={(e) => setCommerce({ ...commerce, downloadLinkValidityHours: num(e.target.value, 72) })} /></FormField>
            </div>
          </FormSection>
          <FormSection title="Panier abandonné" description="Relance par email uniquement aux clients ayant donné leur consentement (case cochée au moment du paiement ou abonnement newsletter).">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={commerce.abandonedCartEmailsEnabled} onChange={(e) => setCommerce({ ...commerce, abandonedCartEmailsEnabled: e.target.checked })} className="size-4 accent-coral" /> Activer les relances</label>
            <FormField label="Délai avant relance (minutes)" htmlFor="c-ab"><Input id="c-ab" type="number" min={30} value={commerce.abandonedCartDelayMinutes} onChange={(e) => setCommerce({ ...commerce, abandonedCartDelayMinutes: num(e.target.value, 120) })} className="max-w-xs" /></FormField>
          </FormSection>
          <Button variant="admin" disabled={pending} onClick={() => save("commerce", commerce)}>Enregistrer</Button>
        </div>
      </TabsContent>

      <TabsContent value="seo">
        <FormSection title="Référencement">
          <FormField label="Titre par défaut" htmlFor="s-t"><Input id="s-t" value={seo.defaultTitle} maxLength={70} onChange={(e) => setSeo({ ...seo, defaultTitle: e.target.value })} /></FormField>
          <FormField label="Modèle de titre" htmlFor="s-tt" hint="%s est remplacé par le titre de la page"><Input id="s-tt" value={seo.titleTemplate} maxLength={70} onChange={(e) => setSeo({ ...seo, titleTemplate: e.target.value })} /></FormField>
          <FormField label="Description par défaut" htmlFor="s-d"><Textarea id="s-d" value={seo.defaultDescription} maxLength={170} onChange={(e) => setSeo({ ...seo, defaultDescription: e.target.value })} className="min-h-[70px]" /></FormField>
          <FormField label="Image Open Graph par défaut" hint="1200×630 px">
            {seo.ogImageUrl && <img src={seo.ogImageUrl} alt="" className="mb-2 max-h-40 rounded-xl" />}
            <UploadField scope="public" accept="image/*" label="Déposer une image" onUploaded={(f) => "url" in f && setSeo({ ...seo, ogImageUrl: f.url })} />
          </FormField>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={seo.robotsIndex} onChange={(e) => setSeo({ ...seo, robotsIndex: e.target.checked })} className="size-4 accent-coral" /> Autoriser l&apos;indexation par les moteurs de recherche</label>
          <div><Button variant="admin" disabled={pending} onClick={() => save("seo", seo)}>Enregistrer</Button></div>
        </FormSection>
      </TabsContent>

      <TabsContent value="analytics">
        <FormSection title="Mesure d'audience et pixels" description="Les scripts ne sont chargés qu'après consentement du visiteur.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Google Analytics 4 (G-XXXX)"><Input value={analytics.gaMeasurementId ?? ""} onChange={(e) => setAnalytics({ ...analytics, gaMeasurementId: e.target.value || null })} /></FormField>
            <FormField label="Google Ads (AW-XXXX)"><Input value={analytics.googleAdsId ?? ""} onChange={(e) => setAnalytics({ ...analytics, googleAdsId: e.target.value || null })} /></FormField>
            <FormField label="Meta Pixel ID"><Input value={analytics.metaPixelId ?? ""} onChange={(e) => setAnalytics({ ...analytics, metaPixelId: e.target.value || null })} /></FormField>
            <FormField label="Pinterest Tag ID"><Input value={analytics.pinterestTagId ?? ""} onChange={(e) => setAnalytics({ ...analytics, pinterestTagId: e.target.value || null })} /></FormField>
            <FormField label="TikTok Pixel ID"><Input value={analytics.tiktokPixelId ?? ""} onChange={(e) => setAnalytics({ ...analytics, tiktokPixelId: e.target.value || null })} /></FormField>
            <FormField label="Jeton Meta Conversions API" hint={analytics.metaCapiToken ? "Un jeton est enregistré (masqué). Saisissez-en un nouveau pour le remplacer." : "Events Manager → Pixel → Paramètres → Générer un jeton d'accès"}><Input type="password" autoComplete="off" placeholder={analytics.metaCapiToken ? "••••••••" : ""} defaultValue="" onChange={(e) => setAnalytics({ ...analytics, metaCapiToken: e.target.value || analytics.metaCapiToken })} /></FormField>
            <FormField label="Jeton TikTok Events API" hint={analytics.tiktokEventsToken ? "Un jeton est enregistré (masqué)." : "TikTok Ads Manager → Événements → Paramètres → Générer un jeton"}><Input type="password" autoComplete="off" placeholder={analytics.tiktokEventsToken ? "••••••••" : ""} defaultValue="" onChange={(e) => setAnalytics({ ...analytics, tiktokEventsToken: e.target.value || analytics.tiktokEventsToken })} /></FormField>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={analytics.consentBannerEnabled} onChange={(e) => setAnalytics({ ...analytics, consentBannerEnabled: e.target.checked })} className="size-4 accent-coral" /> Afficher la bannière de consentement aux cookies</label>
          <div><Button variant="admin" disabled={pending} onClick={() => save("analytics", analytics)}>Enregistrer</Button></div>
        </FormSection>
      </TabsContent>

      <TabsContent value="integration">
        <FormSection title="État des intégrations" description="Configuration lue depuis les variables d'environnement (jamais modifiable ni affichée ici).">
          <ul className="space-y-2">
            <Status ok={it.stripeKeyPresent} label={`Clé secrète Stripe ${it.stripeKeyPresent ? (it.stripeLive ? "(mode PRODUCTION)" : "(mode test)") : "absente"}`} detail="STRIPE_SECRET_KEY" />
            <Status ok={it.publishableKeyPresent} label="Clé publique Stripe" detail="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" />
            <Status ok={it.webhookSecretPresent} label="Secret du webhook Stripe" detail={`STRIPE_WEBHOOK_SECRET · endpoint : ${it.appUrl}/api/stripe/webhook (événements : checkout.session.completed, checkout.session.async_payment_succeeded/failed, checkout.session.expired, payment_intent.payment_failed, charge.refunded)`} />
            <Status ok={it.storageDriver === "s3" ? it.s3Configured : true} label={`Stockage des fichiers : ${it.storageDriver === "s3" ? "S3 compatible" : "local (développement)"}`} detail={it.storageDriver === "local" ? "Passer en S3 (STORAGE_DRIVER=s3) avant la mise en production sur Vercel" : "S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY"} />
            <Status ok={it.emailDriver === "resend" ? it.resendConfigured : true} label={`Emails : ${it.emailDriver === "resend" ? "Resend" : "console (développement)"}`} detail={it.emailDriver === "console" ? "Passer EMAIL_DRIVER=resend et RESEND_API_KEY en production" : "RESEND_API_KEY, EMAIL_FROM"} />
            <Status ok={it.cronSecretPresent} label="Secret des tâches planifiées" detail="CRON_SECRET · /api/cron/publish (publications programmées) et /api/cron/marketing (relances, nouveautés)" />
          </ul>
        </FormSection>
      </TabsContent>
    </Tabs>
  );
}
