"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Store, RefreshCw, Unplug, Check, AlertTriangle, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FormField } from "@/components/admin/form-controls";
import { disconnectAccountAction } from "@/app/actions/admin/marketing-social";
import { saveSettingAction } from "@/app/actions/admin/settings";
import {
  deactivateEtsyAction, publishEtsyAction, saveEtsyOverridesAction, searchEtsyTaxonomyAction, setEtsyAccountSitesAction, syncEtsyNowAction,
} from "@/app/actions/admin/etsy";
import type { EtsySettings } from "@/lib/schemas/settings";
import { estimateEtsyFeesCents } from "@/lib/channels/etsy-listing";
import { formatDate, formatPrice } from "@/lib/utils";

export interface EtsyAccountRow { id: string; name: string; url: string | null; avatarUrl: string | null; needsReconnect: boolean; siteIds: string[]; listings: number }

const STATE_LABEL: Record<string, string> = { pending: "Non publiée", draft: "Brouillon", active: "Active", inactive: "Désactivée", expired: "Expirée", sold_out: "Épuisée", removed: "Supprimée sur Etsy", edit: "En modification" };
export function etsyStateLabel(s: string) { return STATE_LABEL[s] ?? s; }

/* ---------------------------------------------------------------- Comptes */

export function EtsyAccounts({ accounts, sites, configured }: { accounts: EtsyAccountRow[]; sites: Array<{ id: string; name: string }>; configured: boolean }) {
  const router = useRouter();
  const toggleSite = async (a: EtsyAccountRow, siteId: string, on: boolean) => {
    const next = on ? [...new Set([...a.siteIds, siteId])] : a.siteIds.filter((s) => s !== siteId);
    const r = await setEtsyAccountSitesAction(a.id, next);
    if (r.ok) { toast.success("Univers de la boutique enregistrés"); router.refresh(); } else toast.error(r.error);
  };
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#F1641E] text-white"><Store className="size-5" /></span><div><h2 className="font-heading text-lg font-bold">Etsy</h2><p className="text-xs text-ink-soft">Fiches de téléchargement numérique créées depuis vos e-books, ventes importées dans la rentabilité.</p></div></div>
        {configured ? <Badge variant="success"><Check /> App configurée</Badge> : <Badge variant="warning"><AlertTriangle /> Clés manquantes</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant={accounts.length ? "outline" : "admin"} disabled={!configured}>
          <a href="/api/admin/social/etsy/connect">{accounts.length ? <><RefreshCw className="size-4" /> Reconnecter Etsy</> : "Connecter Etsy"}</a>
        </Button>
        <Button asChild size="sm" variant="ghost"><a href="/admin/marketing/etsy">Fiches & ventes Etsy →</a></Button>
      </div>
      {accounts.some((a) => a.needsReconnect) && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">L'autorisation Etsy a expiré ou a été révoquée : reconnectez la boutique.</p>}
      <ul className="mt-4 divide-y divide-line text-sm">
        {accounts.length === 0 && <li className="py-3 text-ink-soft">Aucune boutique connectée. {configured ? "Cliquez sur Connecter Etsy." : <>Renseignez la keystring et le shared secret dans <a href="/admin/parametres?onglet=integration" className="font-semibold text-coral-dark underline">Paramètres → Intégrations</a>.</>}</li>}
        {accounts.map((a) => (
          <li key={a.id} className="py-3">
            <div className="flex items-center gap-3">
              {a.avatarUrl ? <img src={a.avatarUrl} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-ink/5 text-xs font-bold">{a.name.charAt(0)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.name}</p>
                <p className="text-xs text-ink-soft">{a.listings} fiche(s){a.needsReconnect ? " · à reconnecter" : ""}{a.url ? <> · <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">voir la boutique ↗</a></> : null}</p>
              </div>
              <ConfirmButton size="icon-sm" variant="ghost" title="Déconnecter cette boutique Etsy ?" description="Le jeton est supprimé localement. Les fiches déjà publiées restent en ligne sur Etsy." confirmLabel="Déconnecter" onConfirm={async () => { const r = await disconnectAccountAction(a.id); if (r.ok) { toast.success("Boutique déconnectée"); router.refresh(); } return r; }}>
                <Unplug className="size-4" />
              </ConfirmButton>
            </div>
            {sites.length > 1 && (
              <fieldset className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-xs">
                <legend className="sr-only">Univers servis par {a.name}</legend>
                <span className="font-semibold text-ink-soft">Univers :</span>
                {sites.map((s) => (
                  <label key={s.id} className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={a.siteIds.includes(s.id)} onChange={(e) => toggleSite(a, s.id, e.target.checked)} /> {s.name}
                  </label>
                ))}
                {a.siteIds.length === 0 && <span className="text-ink-muted">(aucun coché = tous les univers)</span>}
              </fieldset>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- Synchro */

export function EtsySyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="admin" disabled={pending} onClick={() => start(async () => {
      const r = await syncEtsyNowAction();
      if (r.ok) { toast.success(`${r.data.synced} fiche(s) synchronisée(s), ${r.data.imported} vente(s) importée(s)`); router.refresh(); } else toast.error(r.error);
    })}>
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} /> {pending ? "Synchronisation…" : "Synchroniser maintenant"}
    </Button>
  );
}

/* ---------------------------------------------------------------- Réglages */

function TaxonomyPicker({ value, onChange, label }: { value: number | null | undefined; onChange: (v: number | null) => void; label: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: number; path: string }> | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input aria-label={`Identifiant de catégorie Etsy — ${label}`} inputMode="numeric" className="h-9 w-32 text-sm" value={value ?? ""} placeholder="taxonomy_id" onChange={(e) => { const n = Number(e.target.value); onChange(e.target.value && Number.isInteger(n) && n > 0 ? n : null); }} />
        <Input aria-label={`Rechercher une catégorie Etsy — ${label}`} className="h-9 flex-1 text-sm" value={q} placeholder="Rechercher (ex. coloriage, jeu, enfant)" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLButtonElement | null)?.click(); } }} />
        <Button type="button" size="sm" variant="outline" disabled={pending || q.trim().length < 2} onClick={() => start(async () => {
          const r = await searchEtsyTaxonomyAction(q);
          if (r.ok) setResults(r.data); else toast.error(r.error);
        })}><Search className="size-4" /></Button>
      </div>
      {results && (
        <ul className="max-h-48 overflow-auto rounded-xl border border-line text-xs">
          {results.length === 0 && <li className="px-3 py-2 text-ink-soft">Aucune catégorie trouvée.</li>}
          {results.map((r) => (
            <li key={r.id}><button type="button" className="w-full px-3 py-1.5 text-left hover:bg-ink/5" onClick={() => { onChange(r.id); setResults(null); }}><span className="font-mono text-ink-muted">{r.id}</span> · {r.path}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EtsySettingsForm({ initial, accounts, categories, siteName }: { initial: EtsySettings; accounts: Array<{ id: string; name: string }>; categories: Array<{ slug: string; name: string }>; siteName: string }) {
  const router = useRouter();
  const [s, setS] = useState<EtsySettings>(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof EtsySettings>(k: K, v: EtsySettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const num = (v: string, fallback: number) => { const n = Number(v.replace(",", ".")); return Number.isFinite(n) ? n : fallback; };
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await saveSettingAction("etsy", s);
      if (r.ok) { toast.success(`Réglages Etsy enregistrés (${siteName})`); router.refresh(); } else toast.error(r.error);
    }); }}>
      <label className="flex items-center gap-3 text-sm font-semibold"><Switch checked={s.enabled} onCheckedChange={(v) => set("enabled", v)} /> Publication Etsy activée pour cet univers</label>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Boutique Etsy" htmlFor="etsy-account" hint="Vide = première boutique rattachée à l'univers.">
          <NativeSelect id="etsy-account" value={s.accountId ?? ""} onChange={(e) => set("accountId", e.target.value || null)}>
            <option value="">Automatique</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label="État à la création" htmlFor="etsy-state" hint="Brouillon recommandé : vous validez sur Etsy.">
          <NativeSelect id="etsy-state" value={s.defaultState} onChange={(e) => set("defaultState", e.target.value as EtsySettings["defaultState"])}>
            <option value="draft">Brouillon</option>
            <option value="active">Active (0,20 $ facturés)</option>
          </NativeSelect>
        </FormField>
        <FormField label="Renouvellement automatique" htmlFor="etsy-renew" hint="Etsy refacture 0,20 $ tous les 4 mois.">
          <div className="flex h-11 items-center"><Switch id="etsy-renew" checked={s.autoRenew} onCheckedChange={(v) => set("autoRenew", v)} /></div>
        </FormField>
        <FormField label="Majoration du prix (%)" htmlFor="etsy-markup" hint="Pour couvrir les frais Etsy (ex. 15).">
          <Input id="etsy-markup" inputMode="decimal" value={s.markupPercent} onChange={(e) => set("markupPercent", num(e.target.value, 0))} />
        </FormField>
        <FormField label="Arrondi" htmlFor="etsy-rounding">
          <NativeSelect id="etsy-rounding" value={s.rounding} onChange={(e) => set("rounding", e.target.value as EtsySettings["rounding"])}>
            <option value="90">x,90 €</option>
            <option value="99">x,99 €</option>
            <option value="none">Aucun</option>
          </NativeSelect>
        </FormField>
        <FormField label="Qui l'a fait ?" htmlFor="etsy-who" hint="Champ obligatoire Etsy.">
          <NativeSelect id="etsy-who" value={s.whoMade} onChange={(e) => set("whoMade", e.target.value as EtsySettings["whoMade"])}>
            <option value="i_did">Moi</option>
            <option value="collective">Un membre de ma boutique</option>
            <option value="someone_else">Une autre entreprise</option>
          </NativeSelect>
        </FormField>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm font-semibold"><Switch checked={s.aiDisclosureEnabled} onCheckedChange={(v) => set("aiDisclosureEnabled", v)} /> Mention « créé avec l'aide de l'IA » dans la description</label>
        <Textarea aria-label="Texte de la mention IA" className="min-h-[70px] text-sm" value={s.aiDisclosureText} maxLength={400} onChange={(e) => set("aiDisclosureText", e.target.value)} disabled={!s.aiDisclosureEnabled} />
        <p className="text-xs text-ink-soft">Etsy demande d'indiquer quand un produit a été conçu avec des outils d'IA générative. Laissez cette mention active si vos illustrations ou textes en sont issus.</p>
      </div>
      <div>
        <h3 className="font-heading font-bold">Catégories Etsy</h3>
        <p className="mb-3 text-xs text-ink-soft">Associez chaque catégorie de la boutique à une catégorie Etsy (taxonomy_id). Une fiche ne peut pas être créée sans catégorie.</p>
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[12rem_1fr] md:items-center"><span className="text-sm font-semibold">Par défaut</span><TaxonomyPicker label="par défaut" value={s.defaultTaxonomyId} onChange={(v) => set("defaultTaxonomyId", v)} /></div>
          {categories.map((c) => (
            <div key={c.slug} className="grid gap-2 md:grid-cols-[12rem_1fr] md:items-center">
              <span className="text-sm">{c.name}</span>
              <TaxonomyPicker label={c.name} value={s.taxonomyByCategory[c.slug]} onChange={(v) => setS((p) => { const map = { ...p.taxonomyByCategory }; if (v) map[c.slug] = v; else delete map[c.slug]; return { ...p, taxonomyByCategory: map }; })} />
            </div>
          ))}
        </div>
      </div>
      <details className="rounded-xl border border-line px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Hypothèses de frais (rentabilité)</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <FormField label="Commission (%)" htmlFor="etsy-tx"><Input id="etsy-tx" inputMode="decimal" value={s.transactionFeePercent} onChange={(e) => set("transactionFeePercent", num(e.target.value, 6.5))} /></FormField>
          <FormField label="Paiement (%)" htmlFor="etsy-pay"><Input id="etsy-pay" inputMode="decimal" value={s.paymentFeePercent} onChange={(e) => set("paymentFeePercent", num(e.target.value, 4))} /></FormField>
          <FormField label="Paiement fixe (cts)" htmlFor="etsy-payfix"><Input id="etsy-payfix" inputMode="numeric" value={s.paymentFeeFixedCents} onChange={(e) => set("paymentFeeFixedCents", Math.round(num(e.target.value, 30)))} /></FormField>
          <FormField label="Mise en vente (cts)" htmlFor="etsy-listfee"><Input id="etsy-listfee" inputMode="numeric" value={s.listingFeeCents} onChange={(e) => set("listingFeeCents", Math.round(num(e.target.value, 20)))} /></FormField>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Les ventes Etsy importées sont nettes de ces frais estimés. Ajustez selon votre pays (Etsy Payments) et vérifiez sur votre relevé de paiement Etsy.</p>
      </details>
      <Button type="submit" variant="admin" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer les réglages Etsy"}</Button>
    </form>
  );
}

/* ---------------------------------------------------------------- Produit */

export interface EtsyProductPanelProps {
  productId: string;
  connected: boolean;
  enabled: boolean;
  defaultState: "draft" | "active";
  listing: { id: string; state: string; url: string | null; etsyListingId: string | null; lastSyncedAt: string | null; lastError: string | null } | null;
  generated: { title: string; description: string; tags: string[]; priceCents: number };
  overrides: { title?: string | null; description?: string | null; tags?: string[] | null; priceCents?: number | null } | null;
  fees: Pick<EtsySettings, "transactionFeePercent" | "paymentFeePercent" | "paymentFeeFixedCents" | "listingFeeCents">;
  listingFeeCents: number;
  issues: string[];
  currency: string;
}

export function EtsyProductPanel(p: EtsyProductPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const o = p.overrides ?? {};
  const [title, setTitle] = useState(o.title ?? p.generated.title);
  const [description, setDescription] = useState(o.description ?? p.generated.description);
  const [tags, setTags] = useState((o.tags ?? p.generated.tags).join(", "));
  const [price, setPrice] = useState(((o.priceCents ?? p.generated.priceCents) / 100).toFixed(2).replace(".", ","));
  const priceCents = Math.round(Number(price.replace(",", ".")) * 100) || 0;
  const feesCents = estimateEtsyFeesCents(priceCents, p.fees);
  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
  const live = p.listing && p.listing.etsyListingId && !["removed"].includes(p.listing.state);

  const saveOverrides = () => saveEtsyOverridesAction(p.productId, {
    title: title.trim() === p.generated.title ? null : title,
    description: description.trim() === p.generated.description.trim() ? null : description,
    tags: tagList.join(",") === p.generated.tags.join(",") ? null : tagList,
    priceEuros: Math.round(Number(price.replace(",", ".")) * 100) === p.generated.priceCents ? null : price,
  });
  const publish = (state?: "draft" | "active") => start(async () => {
    const s = await saveOverrides();
    if (!s.ok) { toast.error(s.error); return; }
    const r = await publishEtsyAction(p.productId, state);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.data.created ? "Fiche Etsy créée" : "Fiche Etsy mise à jour");
    r.data.warnings.forEach((w) => toast.warning(w));
    router.refresh();
  });
  const reset = () => { setTitle(p.generated.title); setDescription(p.generated.description); setTags(p.generated.tags.join(", ")); setPrice((p.generated.priceCents / 100).toFixed(2).replace(".", ",")); };

  return (
    <section className="mt-8 rounded-2xl border border-line bg-white p-5" aria-labelledby="etsy-panel-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="etsy-panel-title" className="font-heading text-lg font-bold">Etsy</h2>
          <p className="text-sm text-ink-soft">
            {p.listing ? <>État : <strong>{etsyStateLabel(p.listing.state)}</strong>{p.listing.lastSyncedAt ? ` · synchronisée le ${formatDate(p.listing.lastSyncedAt)}` : ""}</> : "Pas encore publiée sur Etsy."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {live && p.listing?.url && <Button asChild size="sm" variant="ghost"><a href={p.listing.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> Ouvrir sur Etsy</a></Button>}
          {live && p.listing?.state === "active" && (
            <ConfirmButton size="sm" variant="outline" title="Désactiver la fiche Etsy ?" description="La fiche passe en « inactive » sur Etsy ; vous pourrez la réactiver." confirmLabel="Désactiver" disabled={pending} onConfirm={async () => { const r = await deactivateEtsyAction(p.listing!.id); if (r.ok) { toast.success("Fiche désactivée"); router.refresh(); } return r; }}>Désactiver</ConfirmButton>
          )}
          {live ? (
            <>
              <Button size="sm" variant="admin" disabled={pending || !p.connected} onClick={() => publish()}>{pending ? "Envoi…" : "Mettre à jour sur Etsy"}</Button>
              {p.listing?.state !== "active" && <Button size="sm" variant="outline" disabled={pending || !p.connected} onClick={() => publish("active")}>Activer</Button>}
            </>
          ) : (
            <>
              <Button size="sm" variant="admin" disabled={pending || !p.connected} onClick={() => publish(p.defaultState)}>{pending ? "Envoi…" : p.defaultState === "active" ? "Publier sur Etsy" : "Publier en brouillon sur Etsy"}</Button>
              {p.defaultState === "draft" && <Button size="sm" variant="outline" disabled={pending || !p.connected} onClick={() => publish("active")}>Publier et activer</Button>}
            </>
          )}
        </div>
      </div>
      {!p.connected && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Aucune boutique Etsy rattachée à cet univers : connectez-la dans <a className="underline" href="/admin/marketing/connecteurs">Marketing social → Connecteurs</a>.</p>}
      {p.connected && !p.enabled && <p className="mt-3 rounded-xl bg-ink/5 px-3 py-2 text-xs text-ink-soft">La publication Etsy automatique (autopilote) est désactivée pour cet univers ; la publication manuelle reste possible. Réglages dans <a className="underline" href="/admin/marketing/etsy">Marketing social → Etsy</a>.</p>}
      {p.listing?.lastError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Dernière erreur : {p.listing.lastError}</p>}
      {p.issues.length > 0 && <ul className="mt-3 list-disc space-y-0.5 rounded-xl bg-amber-50 py-2 pl-8 pr-3 text-xs text-amber-900">{p.issues.map((i) => <li key={i}>{i}</li>)}</ul>}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-4">
          <FormField label={`Titre (${title.length}/140)`} htmlFor="etsy-title"><Input id="etsy-title" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} /></FormField>
          <FormField label={`Mots-clés (${tagList.length}/13, 20 caractères max.)`} htmlFor="etsy-tags" hint="Séparés par des virgules." error={tagList.some((t) => t.length > 20) ? "Un mot-clé dépasse 20 caractères." : tagList.length > 13 ? "13 mots-clés maximum." : null}>
            <Input id="etsy-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </FormField>
          <FormField label="Description (texte brut)" htmlFor="etsy-desc"><Textarea id="etsy-desc" className="min-h-[260px] font-mono text-xs" value={description} onChange={(e) => setDescription(e.target.value)} /></FormField>
        </div>
        <aside className="space-y-3 text-sm">
          <FormField label="Prix Etsy (€)" htmlFor="etsy-price"><Input id="etsy-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></FormField>
          <dl className="space-y-1 rounded-xl bg-ink/5 p-3 text-xs">
            <div className="flex justify-between"><dt>Frais par vente estimés (dont renouvellement)</dt><dd>{formatPrice(feesCents, p.currency)}</dd></div>
            <div className="flex justify-between"><dt>Mise en vente (une fois)</dt><dd>0,20 $ ≈ {formatPrice(p.listingFeeCents, p.currency)}</dd></div>
            <div className="flex justify-between font-bold"><dt>Net estimé / vente</dt><dd>{formatPrice(Math.max(0, priceCents - feesCents), p.currency)}</dd></div>
          </dl>
          <p className="text-xs text-ink-soft">Commission {p.fees.transactionFeePercent} % + paiement {p.fees.paymentFeePercent} % + {formatPrice(p.fees.paymentFeeFixedCents, p.currency)} (réglables). Produit numérique : Etsy livre les fichiers après paiement.</p>
          <Button type="button" size="sm" variant="ghost" onClick={reset}>Revenir au texte généré</Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await saveOverrides(); if (r.ok) { toast.success("Aperçu Etsy enregistré"); router.refresh(); } else toast.error(r.error); })}>Enregistrer sans publier</Button>
        </aside>
      </div>
    </section>
  );
}
