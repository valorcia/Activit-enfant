"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Store, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { JobProgress } from "@/components/job-progress";
import { publishToShopAction, saveShopListingAction, shopTaxonomyAction } from "@/app/actions/shop";
import { SHOP_TEMPLATES, type ShopListing } from "@/lib/schemas/settings";
import { formatDate } from "@/lib/utils";

export interface ShopSyncView {
  configured: boolean;
  shopUrl: string | null;
  productId: string | null;
  productSlug: string | null;
  /** URL publique renvoyée par la boutique (domaine de l'univers) */
  publicUrl?: string | null;
  /** Univers ciblé (nom affiché) */
  siteName?: string | null;
  publishedAt: string | null;
  lastSyncAt: string | null;
  syncError: string | null;
  listing: ShopListing;
  defaults: { priceCents: number; categorySlug: string; template: string; autoPublish: boolean; name: string; tagline: string; shortDescription: string };
  hasExport: boolean;
}

const TEMPLATE_LABELS: Record<string, string> = { ADVENTURE: "Aventure / chasse au trésor", ACTIVITY: "Cahier d'activités", STORY: "Histoire / e-book", EVENT: "Kit événement", CLASSIC: "Fiche classique", GUIDE: "Guide pratique", RECIPES: "Livre de recettes" };

export function ShopTab({ bookId, sync }: { bookId: string; sync: ShopSyncView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [listing, setListing] = useState<ShopListing>(sync.listing);
  const [jobId, setJobId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [taxonomy, setTaxonomy] = useState<{ categories: Array<{ slug: string; name: string }>; collections: Array<{ slug: string; name: string }> } | null>(null);
  const [faqText, setFaqText] = useState((listing.faq ?? []).map((f) => `${f.question}\n${f.answer}`).join("\n\n"));

  useEffect(() => {
    if (sync.configured) shopTaxonomyAction().then(setTaxonomy).catch(() => setTaxonomy(null));
  }, [sync.configured]);

  const set = <K extends keyof ShopListing>(k: K, v: ShopListing[K]) => setListing((l) => ({ ...l, [k]: v }));
  const publicUrl = sync.publishedAt ? (sync.publicUrl ?? (sync.productSlug && sync.shopUrl ? `${sync.shopUrl}/aventures/${sync.productSlug}` : null)) : null;
  const adminUrl = sync.productId && sync.shopUrl ? `${sync.shopUrl}/admin/produits/${sync.productId}` : null;
  const state = !sync.productId ? "never" : sync.publishedAt ? "published" : "draft";

  const save = () => start(async () => {
    const faq = faqText.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean).map((block) => { const [q, ...rest] = block.split("\n"); return { question: q.trim(), answer: rest.join("\n").trim() }; }).filter((f) => f.question && f.answer);
    await saveShopListingAction(bookId, { ...listing, faq });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    router.refresh();
  });
  const publish = (publishNow: boolean) => start(async () => {
    const r = await publishToShopAction(bookId, { publish: publishNow });
    setJobId(r.jobId);
  });

  if (!sync.configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">
        <div className="flex items-center gap-2 font-bold"><Store className="h-4 w-4" /> Boutique non configurée</div>
        <p className="mt-1 text-amber-900">Renseignez l'URL de la boutique et une clé API dans <a href="/settings" className="underline">Paramètres</a> pour publier automatiquement ce livre comme e-book.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold flex items-center gap-2"><Store className="h-4 w-4" /> Fiche dans la boutique</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {state === "never" && <Badge variant="secondary">Jamais publié</Badge>}
              {state === "draft" && <Badge variant="warning">Brouillon — validation dans la boutique</Badge>}
              {state === "published" && <Badge variant="success">Publié</Badge>}
              {sync.siteName && <Badge variant="secondary">Univers : {sync.siteName}</Badge>}
              {sync.lastSyncAt && <span className="text-slate-500">Dernière synchronisation : {formatDate(sync.lastSyncAt)}</span>}
            </div>
            {sync.syncError && <p className="mt-2 text-xs text-amber-800 bg-amber-50 rounded-md px-2 py-1">{sync.syncError}</p>}
            {!sync.hasExport && <p className="mt-2 text-xs text-slate-500">Aucun export PDF terminé : lancez un export numérique (onglet Exports) pour que le fichier soit joint à la fiche. La publication automatique se déclenche à la fin de l'export.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {publicUrl && <Button asChild variant="secondary"><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Voir la landing page</a></Button>}
            {adminUrl && <Button asChild variant="ghost"><a href={adminUrl} target="_blank" rel="noreferrer">Ouvrir dans l'admin boutique</a></Button>}
            <Button variant="secondary" disabled={pending} onClick={() => publish(false)}><RefreshCw className="h-4 w-4 mr-1" /> {sync.productId ? "Mettre à jour la fiche" : "Créer en brouillon"}</Button>
            <Button disabled={pending} onClick={() => publish(true)}>{state === "published" ? "Republier" : "Publier dans la boutique"}</Button>
          </div>
        </div>
        {jobId && <div className="mt-4"><JobProgress jobId={jobId} title="Synchronisation boutique" compact onDone={() => router.refresh()} /></div>}
      </div>

      <form className="rounded-xl border border-slate-200 bg-white p-5 space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div>
          <h3 className="font-bold">Fiche commerciale</h3>
          <p className="text-sm text-slate-600">Les champs vides reprennent automatiquement les informations du livre (titre, sous-titre, sommaire, âge, nombre de pages).</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nom commercial"><Input value={listing.name ?? ""} placeholder={sync.defaults.name} onChange={(e) => set("name", e.target.value || undefined)} /></Field>
          <Field label="Sous-titre (bénéfice principal)"><Input value={listing.tagline ?? ""} placeholder={sync.defaults.tagline} onChange={(e) => set("tagline", e.target.value || undefined)} /></Field>
          <Field label="Prix (€ TTC)"><Input type="number" min={0} step="0.1" value={listing.priceCents != null ? (listing.priceCents / 100).toFixed(2) : ""} placeholder={(sync.defaults.priceCents / 100).toFixed(2)} onChange={(e) => set("priceCents", e.target.value === "" ? undefined : Math.round(Number(e.target.value) * 100))} /></Field>
          <Field label="Prix promotionnel (€ TTC, facultatif)"><Input type="number" min={0} step="0.1" value={listing.salePriceCents != null ? (listing.salePriceCents / 100).toFixed(2) : ""} onChange={(e) => set("salePriceCents", e.target.value === "" ? undefined : Math.round(Number(e.target.value) * 100))} /></Field>
          <Field label="Catégorie">
            {taxonomy ? (
              <Select value={listing.categorySlug ?? ""} onChange={(e) => set("categorySlug", e.target.value || undefined)}>
                <option value="">Par défaut ({sync.defaults.categorySlug})</option>
                {taxonomy.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </Select>
            ) : <Input value={listing.categorySlug ?? ""} placeholder={sync.defaults.categorySlug} onChange={(e) => set("categorySlug", e.target.value || undefined)} />}
          </Field>
          <Field label="Modèle de fiche">
            <Select value={listing.template ?? ""} onChange={(e) => set("template", (e.target.value || undefined) as ShopListing["template"])}>
              <option value="">Par défaut ({TEMPLATE_LABELS[sync.defaults.template] ?? sync.defaults.template})</option>
              {SHOP_TEMPLATES.map((t) => <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>)}
            </Select>
          </Field>
          {taxonomy && taxonomy.collections.length > 0 && (
            <Field label="Collections" hint="Maintenez Ctrl/Cmd pour en choisir plusieurs.">
              <select multiple className="flex min-h-[90px] w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm" value={listing.collectionSlugs ?? []} onChange={(e) => set("collectionSlugs", Array.from(e.target.selectedOptions).map((o) => o.value))}>
                {taxonomy.collections.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Univers / thème"><Input value={listing.universe ?? ""} placeholder="Pirates, Dinosaures, Espace…" onChange={(e) => set("universe", e.target.value || undefined)} /></Field>
          <Field label="Âge minimum"><Input type="number" min={0} value={listing.ageMin ?? ""} onChange={(e) => set("ageMin", e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
          <Field label="Âge maximum"><Input type="number" min={0} value={listing.ageMax ?? ""} onChange={(e) => set("ageMax", e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
        </div>
        <Field label="Description courte (listes et aperçus)"><Textarea value={listing.shortDescription ?? ""} placeholder={sync.defaults.shortDescription} onChange={(e) => set("shortDescription", e.target.value || undefined)} /></Field>
        <Field label="Description longue (markdown)" hint="Vide : introduction du livre + sommaire des activités."><Textarea className="min-h-[140px]" value={listing.longDescription ?? ""} onChange={(e) => set("longDescription", e.target.value || undefined)} /></Field>
        <Field label="Histoire / présentation immersive (markdown)"><Textarea value={listing.story ?? ""} onChange={(e) => set("story", e.target.value || undefined)} /></Field>
        <Field label="FAQ produit" hint="Une question puis sa réponse sur la ligne suivante ; séparez les entrées par une ligne vide."><Textarea className="min-h-[120px]" value={faqText} onChange={(e) => setFaqText(e.target.value)} /></Field>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Titre SEO (70 car. max)"><Input maxLength={70} value={listing.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value || undefined)} /></Field>
          <Field label="Meta description (170 car. max)"><Input maxLength={170} value={listing.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value || undefined)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={listing.autoPublish ?? sync.defaults.autoPublish} onChange={(e) => set("autoPublish", e.target.checked)} />
          Publier automatiquement dans la boutique à chaque export PDF de ce livre
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}><Save className="h-4 w-4 mr-1" /> Enregistrer la fiche</Button>
          {saved && <span className="text-sm text-emerald-700">Fiche enregistrée.</span>}
        </div>
      </form>
    </div>
  );
}
