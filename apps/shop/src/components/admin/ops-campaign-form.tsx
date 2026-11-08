"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormField, FormSection } from "@/components/admin/form-controls";
import type { CampaignFormValues } from "@/lib/admin/campaign-form-data";
import { saveCampaignAction } from "@/app/actions/admin/marketing-social";

export function CampaignForm({ initial, products, adAccounts }: { initial: CampaignFormValues; products: Array<{ id: string; name: string }>; adAccounts: Array<{ id: string; name: string; provider: string }> }) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof CampaignFormValues>(k: K, v: CampaignFormValues[K]) => setF((s) => ({ ...s, [k]: v }));

  const submit = () => start(async () => {
    const budget = f.dailyBudget.trim() ? Math.round(Number(f.dailyBudget.replace(",", ".")) * 100) : undefined;
    const r = await saveCampaignAction(f.id ?? null, { ...f, dailyBudgetCents: budget, productId: f.productId || null, adAccountId: f.adAccountId || null, externalCampaignId: f.externalCampaignId || null, startsAt: f.startsAt || undefined, endsAt: f.endsAt || undefined });
    if (!r.ok) { setErrors(r.fields ?? {}); toast.error(r.error); return; }
    toast.success("Campagne enregistrée");
    router.push(`/admin/marketing/campagnes/${r.data.id}`);
    router.refresh();
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-6">
      <FormSection title="Campagne" description="Le slug devient le paramètre utm_campaign : il identifie les ventes issues de cette campagne.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nom" htmlFor="name" required error={errors.name}><Input id="name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Lancement Coquelicot – Instagram" required /></FormField>
          <FormField label="Slug (utm_campaign)" htmlFor="slug" hint="Généré depuis le nom si vide" error={errors.slug}><Input id="slug" value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="lancement-coquelicot" /></FormField>
          <FormField label="E-book" htmlFor="productId" error={errors.productId}><NativeSelect id="productId" value={f.productId} onChange={(e) => set("productId", e.target.value)}><option value="">— Boutique entière —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></FormField>
          <FormField label="Objectif" htmlFor="objective"><NativeSelect id="objective" value={f.objective} onChange={(e) => set("objective", e.target.value)}><option value="ventes">Ventes</option><option value="trafic">Trafic</option><option value="notoriete">Notoriété</option><option value="newsletter">Inscriptions newsletter</option></NativeSelect></FormField>
          <FormField label="Canal" htmlFor="channel"><NativeSelect id="channel" value={f.channel} onChange={(e) => { const c = e.target.value as CampaignFormValues["channel"]; set("channel", c); if (c === "TIKTOK") set("utmSource", "tiktok"); if (c === "META" && f.utmSource === "tiktok") set("utmSource", "facebook"); }}><option value="META">Meta (Facebook / Instagram)</option><option value="TIKTOK">TikTok</option><option value="OTHER">Autre</option></NativeSelect></FormField>
          <FormField label="Source (utm_source)" htmlFor="utmSource" error={errors.utmSource}><NativeSelect id="utmSource" value={f.utmSource} onChange={(e) => set("utmSource", e.target.value)}>{["facebook", "instagram", "tiktok", "pinterest", "newsletter", "influence", "autre"].map((s) => <option key={s} value={s}>{s}</option>)}</NativeSelect></FormField>
          <FormField label="Type (utm_medium)" htmlFor="utmMedium"><NativeSelect id="utmMedium" value={f.utmMedium} onChange={(e) => set("utmMedium", e.target.value as "social" | "paid")}><option value="paid">Publicité payante (paid)</option><option value="social">Publication organique (social)</option></NativeSelect></FormField>
          <FormField label="Statut" htmlFor="status"><NativeSelect id="status" value={f.status} onChange={(e) => set("status", e.target.value as CampaignFormValues["status"])}><option value="DRAFT">Brouillon</option><option value="ACTIVE">Active</option><option value="PAUSED">En pause</option><option value="ENDED">Terminée</option></NativeSelect></FormField>
          <FormField label="Début" htmlFor="startsAt"><Input id="startsAt" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></FormField>
          <FormField label="Fin" htmlFor="endsAt"><Input id="endsAt" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></FormField>
          <FormField label="Budget quotidien indicatif (€)" htmlFor="dailyBudget"><Input id="dailyBudget" inputMode="decimal" value={f.dailyBudget} onChange={(e) => set("dailyBudget", e.target.value)} placeholder="10" /></FormField>
        </div>
      </FormSection>
      <FormSection title="Dépenses publicitaires (facultatif)" description="Liez la campagne créée dans le Gestionnaire de publicités pour importer automatiquement les dépenses. Sinon, saisissez-les à la main sur la page de la campagne.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Compte publicitaire connecté" htmlFor="adAccountId"><NativeSelect id="adAccountId" value={f.adAccountId} onChange={(e) => set("adAccountId", e.target.value)}><option value="">— Aucun (saisie manuelle) —</option>{adAccounts.map((a) => <option key={a.id} value={a.id}>{a.provider} · {a.name}</option>)}</NativeSelect></FormField>
          <FormField label="Identifiant de la campagne externe" htmlFor="externalCampaignId" hint="Copiez l'ID depuis le Gestionnaire de publicités"><Input id="externalCampaignId" value={f.externalCampaignId} onChange={(e) => set("externalCampaignId", e.target.value)} /></FormField>
        </div>
        <FormField label="Notes" htmlFor="notes" className="mt-4"><Textarea id="notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} /></FormField>
      </FormSection>
      <div className="flex justify-end gap-2"><Button type="submit" variant="admin" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button></div>
    </form>
  );
}
