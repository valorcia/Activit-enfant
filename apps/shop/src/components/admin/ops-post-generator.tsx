"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, ClipboardPaste, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { FormField, FormSection } from "@/components/admin/form-controls";
import { CopyField } from "@/components/admin/ops-copy-field";
import { Alert } from "@/components/ui/misc";
import { CHANNELS, CHANNEL_LABELS, type Channel } from "@/lib/social/copywriter";
import { generateWithApiAction, importPastedVariantsAction, prepareGenerationAction } from "@/app/actions/admin/marketing-social";

export function PostGenerator({ products, campaigns, apiAvailable, defaults }: { products: Array<{ id: string; name: string }>; campaigns: Array<{ id: string; name: string; productId: string | null }>; apiAvailable: boolean; defaults: { productId: string; campaignId: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [productId, setProductId] = useState(defaults.productId || products[0]?.id || "");
  const [campaignId, setCampaignId] = useState(defaults.campaignId);
  const [channels, setChannels] = useState<Channel[]>(["instagram", "facebook"]);
  const [variants, setVariants] = useState(3);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [mode, setMode] = useState<"api" | "manual">(apiAvailable ? "api" : "manual");

  const toggle = (c: Channel) => setChannels((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const args = { productId, campaignId: campaignId || null, channels, variants };

  return (
    <FormSection title="Générer des variantes" description="Textes rédigés à partir des données réelles de la fiche produit (jamais de faux avis ni de chiffres inventés). Trois angles différents par canal.">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="E-book" htmlFor="g-product"><NativeSelect id="g-product" value={productId} onChange={(e) => setProductId(e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></FormField>
        <FormField label="Campagne (lien tracé)" htmlFor="g-campaign" hint="Sans campagne : lien organique"><NativeSelect id="g-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}><option value="">— Aucune —</option>{campaigns.filter((c) => !c.productId || c.productId === productId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></FormField>
        <FormField label="Variantes par canal" htmlFor="g-variants"><NativeSelect id="g-variants" value={String(variants)} onChange={(e) => setVariants(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect></FormField>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-bold">Canaux</legend>
        <div className="mt-2 flex flex-wrap gap-2">{CHANNELS.map((c) => <label key={c} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold ${channels.includes(c) ? "border-ink bg-ink text-white" : "border-line bg-white"}`}><input type="checkbox" className="sr-only" checked={channels.includes(c)} onChange={() => toggle(c)} />{CHANNEL_LABELS[c]}</label>)}</div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-ink/5 p-0.5 text-xs font-bold">
          <button type="button" className={`rounded-full px-3 py-1 ${mode === "api" ? "bg-white shadow-sm" : "text-ink-soft"}`} onClick={() => setMode("api")} disabled={!apiAvailable} title={apiAvailable ? "" : "Clé Claude non configurée (Paramètres → Intégrations)"}>API Claude</button>
          <button type="button" className={`rounded-full px-3 py-1 ${mode === "manual" ? "bg-white shadow-sm" : "text-ink-soft"}`} onClick={() => setMode("manual")}>Copier-coller (Claude / ChatGPT)</button>
        </div>
        {mode === "api" ? (
          <Button variant="admin" size="sm" disabled={pending || !productId || channels.length === 0} onClick={() => start(async () => { const r = await generateWithApiAction(args); if (!r.ok) { toast.error(r.error); return; } toast.success(`${r.data.ids.length} variante(s) générée(s)`); router.refresh(); })}><Sparkles className="size-4" /> {pending ? "Génération…" : "Générer avec Claude"}</Button>
        ) : (
          <Button variant="admin" size="sm" disabled={pending || !productId || channels.length === 0} onClick={() => start(async () => { const r = await prepareGenerationAction(args); if (!r.ok) { toast.error(r.error); return; } setPrompt(r.data.prompt); })}><ClipboardPaste className="size-4" /> Préparer le prompt</Button>
        )}
      </div>
      {!apiAvailable && mode === "manual" && <p className="mt-2 text-xs text-ink-muted">Sans clé API, copiez le prompt dans Claude.ai ou ChatGPT, puis collez la réponse JSON ci-dessous.</p>}

      {mode === "manual" && prompt && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold">1. Copiez le prompt et collez-le dans :</span>
            <Button asChild size="sm" variant="outline"><a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">Claude <ExternalLink className="size-3.5" /></a></Button>
            <Button asChild size="sm" variant="outline"><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT <ExternalLink className="size-3.5" /></a></Button>
          </div>
          <CopyField value={prompt} multiline label="Copier le prompt" />
          <FormField label="2. Collez la réponse (JSON)" htmlFor="g-paste"><Textarea id="g-paste" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{"variants":[…]}' /></FormField>
          <Button variant="admin" size="sm" disabled={pending || !pasted.trim()} onClick={() => start(async () => { const r = await importPastedVariantsAction({ productId, campaignId: campaignId || null, pasted }); if (!r.ok) { toast.error(r.error); return; } toast.success(`${r.data.ids.length} variante(s) importée(s)`); setPasted(""); setPrompt(null); router.refresh(); })}>Valider les variantes</Button>
          <Alert variant="info">Les textes sont validés (longueurs, canaux) puis enregistrés en brouillon : vous les relisez avant toute publication.</Alert>
        </div>
      )}
    </FormSection>
  );
}
