"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField, FormSection } from "@/components/admin/form-controls";
import { UploadField } from "@/components/admin/upload-field";
import { saveSettingAction } from "@/app/actions/admin/settings";
import type { AnalyticsSettings, CommerceSettings, SeoSettings, SettingsKey } from "@/lib/schemas/settings";
import type { SecretStatus } from "@/lib/integrations/secrets";
import { IntegrationsForm, type InfraState } from "@/components/admin/ops-integrations-form";

export interface IntegrationsProps { statuses: SecretStatus[]; canEncrypt: boolean; infra: InfraState }

export function SettingsForm({ commerce: c0, seo: s0, analytics: a0, integrations, defaultTab = "commerce" }: { commerce: CommerceSettings; seo: SeoSettings; analytics: AnalyticsSettings; integrations: IntegrationsProps; defaultTab?: string }) {
  const [commerce, setCommerce] = useState(c0);
  const [seo, setSeo] = useState(s0);
  const [analytics, setAnalytics] = useState(a0);
  const [pending, start] = useTransition();
  const save = (key: SettingsKey, value: unknown) => start(async () => { const r = await saveSettingAction(key, value); r.ok ? toast.success("Enregistré") : toast.error(r.error); });
  const num = (v: string, fallback: number) => (v === "" ? fallback : Number(v));

  return (
    <Tabs defaultValue={defaultTab}>
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
          </div>
          <p className="text-xs text-ink-muted">Les jetons serveur (Meta Conversions API, TikTok Events API) se saisissent dans l&apos;onglet Intégrations.</p>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={analytics.consentBannerEnabled} onChange={(e) => setAnalytics({ ...analytics, consentBannerEnabled: e.target.checked })} className="size-4 accent-coral" /> Afficher la bannière de consentement aux cookies</label>
          <div><Button variant="admin" disabled={pending} onClick={() => save("analytics", analytics)}>Enregistrer</Button></div>
        </FormSection>
      </TabsContent>

      <TabsContent value="integration">
        <IntegrationsForm statuses={integrations.statuses} canEncrypt={integrations.canEncrypt} infra={integrations.infra} />
      </TabsContent>
    </Tabs>
  );
}
