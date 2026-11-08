"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Eye, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-controls";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteSiteAction, saveAudienceAction, saveSiteAction } from "@/app/actions/admin/sites";
import type { FieldErrors } from "@/lib/admin/action-result";
import { slugify } from "@/lib/utils";

export interface SiteRow {
  id: string; slug: string; name: string; audienceId: string; audienceName: string; preset: string; status: string;
  domains: string[]; primaryDomain: string | null; isDefault: boolean; url: string; previewUrl: string; hubUrl: string | null;
  counts: { products: number; categories: number; orders: number };
}
export interface AudienceRow { id: string; slug: string; name: string; description: string | null; color: string | null; siteCount: number; accountCount: number }
export interface PresetOption { id: string; label: string; description: string; categories: string[] }

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "soft" }> = {
  ACTIVE: { label: "Actif", variant: "success" },
  TEST: { label: "Test", variant: "warning" },
  ARCHIVED: { label: "Archivé", variant: "soft" },
};

type SiteDraft = Partial<Omit<SiteRow, "domains">> & { domains?: string };
type AudienceDraft = Partial<AudienceRow>;

export function SitesManager({ sites, audiences, presets }: { sites: SiteRow[]; audiences: AudienceRow[]; presets: PresetOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [site, setSite] = useState<SiteDraft | null>(null);
  const [audience, setAudience] = useState<AudienceDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const patchSite = (p: SiteDraft) => setSite((s) => ({ ...(s ?? {}), ...p }));
  const patchAudience = (p: AudienceDraft) => setAudience((a) => ({ ...(a ?? {}), ...p }));
  const preset = presets.find((p) => p.id === (site?.preset ?? "kit-enfants"));

  function submitSite() {
    if (!site) return;
    start(async () => {
      setErrors({});
      const r = await saveSiteAction(site.id ?? null, {
        name: site.name ?? "", slug: site.slug ?? "", audienceId: site.audienceId ?? "", preset: site.preset ?? "kit-enfants",
        status: site.status ?? "TEST", domains: site.domains ?? "", primaryDomain: site.primaryDomain || null, isDefault: site.isDefault ?? false,
      });
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
      toast.success(site.id ? "Univers enregistré" : "Univers créé avec ses catégories de départ");
      setSite(null);
      router.refresh();
    });
  }

  function submitAudience() {
    if (!audience) return;
    start(async () => {
      setErrors({});
      const r = await saveAudienceAction(audience.id ?? null, { name: audience.name ?? "", slug: audience.slug ?? "", description: audience.description ?? "", color: audience.color ?? "" });
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
      toast.success("Audience enregistrée");
      setAudience(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold">Univers ({sites.length})</h2>
          <Button variant="admin" size="sm" onClick={() => { setErrors({}); setSite({ status: "TEST", preset: "guide-expert", audienceId: audiences[0]?.id, domains: "" }); }}><Plus className="size-4" /> Nouvel univers</Button>
        </div>
        <ul className="grid gap-3 lg:grid-cols-2">
          {sites.map((s) => (
            <li key={s.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-heading text-lg font-bold">
                    {s.name}
                    <Badge variant={STATUS[s.status]?.variant ?? "soft"}>{STATUS[s.status]?.label ?? s.status}</Badge>
                    {s.isDefault && <Badge variant="soft"><Star /> Par défaut</Badge>}
                  </p>
                  <p className="text-xs text-ink-muted">{s.slug} · audience {s.audienceName} · préréglage {presets.find((p) => p.id === s.preset)?.label ?? s.preset}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${s.name}`} onClick={() => { setErrors({}); setSite({ ...s, domains: s.domains.join("\n") }); }}><Pencil className="size-4" /></Button>
                  {!s.isDefault && (
                    <ConfirmButton variant="ghost" size="icon-sm" className="text-red-600" title={`Supprimer « ${s.name} » ?`} description="Possible seulement sans produits, packs ni commandes : ses catégories, collections, pages, articles et abonnés seront supprimés. Sinon, archivez-le." confirmLabel="Supprimer" onConfirm={async () => { const r = await deleteSiteAction(s.id); if (r.ok) { toast.success("Univers supprimé"); router.refresh(); } return r; }}>
                      <Trash2 className="size-4" />
                    </ConfirmButton>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm">
                {s.domains.length ? s.domains.map((d) => <span key={d} className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${d === (s.primaryDomain ?? s.domains[0]) ? "bg-ink text-white" : "bg-ink/5"}`}>{d}</span>) : <span className="text-xs text-ink-soft">Aucun domaine : servi sur l&apos;adresse de l&apos;application{s.isDefault ? " (univers par défaut)" : " via l'aperçu"}.</span>}
              </p>
              <p className="mt-2 text-xs text-ink-soft">{s.counts.products} produit(s) · {s.counts.categories} catégorie(s) · {s.counts.orders} commande(s)</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><a href={s.previewUrl} target="_blank" rel="noopener"><Eye className="size-4" /> Aperçu</a></Button>
                {s.status === "ACTIVE" && s.domains.length > 0 && <Button asChild size="sm" variant="ghost"><a href={s.url} target="_blank" rel="noopener"><ExternalLink className="size-4" /> {s.url.replace(/^https?:\/\//, "")}</a></Button>}
                {s.hubUrl && <Button asChild size="sm" variant="ghost"><a href={s.hubUrl} target="_blank" rel="noopener">{s.hubUrl.replace(/^https?:\/\//, "")}</a></Button>}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">L&apos;aperçu <code>/?site=slug</code> mémorise l&apos;univers dans votre navigateur pendant 7 jours (cookie) ; <code>/?site=</code> le réinitialise.</p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold">Audiences ({audiences.length})</h2>
          <Button variant="outline" size="sm" onClick={() => { setErrors({}); setAudience({ color: "#293241" }); }}><Plus className="size-4" /> Nouvelle audience</Button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {audiences.map((a) => (
            <li key={a.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 font-bold"><span className="size-3 rounded-full" style={{ background: a.color ?? "#293241" }} />{a.name}</p>
                <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${a.name}`} onClick={() => { setErrors({}); setAudience(a); }}><Pencil className="size-4" /></Button>
              </div>
              {a.description && <p className="mt-1 text-xs text-ink-soft">{a.description}</p>}
              <p className="mt-2 text-xs text-ink-muted">{a.siteCount} univers · {a.accountCount} compte(s) social(aux)</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">Les pages Facebook, comptes Instagram/TikTok et comptes publicitaires se rattachent à une audience dans Marketing social → Connecteurs.</p>
      </section>

      <Dialog open={!!site} onOpenChange={(o) => !o && setSite(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{site?.id ? `Modifier « ${site.name} »` : "Nouvel univers"}</DialogTitle></DialogHeader>
          {site && (
            <form onSubmit={(e) => { e.preventDefault(); submitSite(); }} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nom de la boutique" htmlFor="si-name" required error={errors.name}><Input id="si-name" value={site.name ?? ""} onChange={(e) => patchSite({ name: e.target.value, slug: site.id ? site.slug : slugify(e.target.value) })} required /></FormField>
                <FormField label="Slug" htmlFor="si-slug" hint="Identifiant technique (aperçu, API : siteSlug)" error={errors.slug}><Input id="si-slug" value={site.slug ?? ""} onChange={(e) => patchSite({ slug: slugify(e.target.value) })} required /></FormField>
                <FormField label="Audience" htmlFor="si-aud" required error={errors.audienceId}>
                  <NativeSelect id="si-aud" value={site.audienceId ?? ""} onChange={(e) => patchSite({ audienceId: e.target.value })}>
                    {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </NativeSelect>
                </FormField>
                <FormField label="Statut" htmlFor="si-status" hint="Test : servi sur ses domaines et en aperçu, jamais indexé" error={errors.status}>
                  <NativeSelect id="si-status" value={site.status ?? "TEST"} onChange={(e) => patchSite({ status: e.target.value })}>
                    <option value="TEST">Test</option><option value="ACTIVE">Actif</option><option value="ARCHIVED">Archivé</option>
                  </NativeSelect>
                </FormField>
              </div>
              <FormField label="Préréglage (thème, ton, modèle de fiche, catégories)" htmlFor="si-preset" hint={preset ? `${preset.description}${site.id ? "" : ` Catégories créées : ${preset.categories.join(", ")}.`}` : undefined} error={errors.preset}>
                <NativeSelect id="si-preset" value={site.preset ?? "kit-enfants"} onChange={(e) => patchSite({ preset: e.target.value })}>
                  {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </NativeSelect>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Domaines" htmlFor="si-domains" hint="Un par ligne, ex. finileauverte.fr et www.finileauverte.fr" error={errors.domains}><Textarea id="si-domains" value={site.domains ?? ""} onChange={(e) => patchSite({ domains: e.target.value })} className="min-h-[90px]" /></FormField>
                <FormField label="Domaine principal" htmlFor="si-primary" hint="Utilisé pour les liens, emails, sitemap et Stripe (défaut : le premier)" error={errors.primaryDomain}><Input id="si-primary" value={site.primaryDomain ?? ""} onChange={(e) => patchSite({ primaryDomain: e.target.value })} placeholder="www.exemple.fr" /></FormField>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={site.isDefault ?? false} onChange={(e) => patchSite({ isDefault: e.target.checked })} className="size-4 accent-coral" /> Univers par défaut (servi sur les domaines inconnus et l&apos;adresse de l&apos;application)</label>
              {errors.isDefault && <p className="text-xs font-semibold text-red-600">{errors.isDefault[0]}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setSite(null)}>Annuler</Button>
                <Button type="submit" variant="admin" disabled={pending}>{site.id ? "Enregistrer" : "Créer l'univers"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!audience} onOpenChange={(o) => !o && setAudience(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{audience?.id ? `Modifier « ${audience.name} »` : "Nouvelle audience"}</DialogTitle></DialogHeader>
          {audience && (
            <form onSubmit={(e) => { e.preventDefault(); submitAudience(); }} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nom" htmlFor="au-name" required error={errors.name}><Input id="au-name" value={audience.name ?? ""} onChange={(e) => patchAudience({ name: e.target.value, slug: audience.id ? audience.slug : slugify(e.target.value) })} required /></FormField>
                <FormField label="Slug" htmlFor="au-slug" error={errors.slug}><Input id="au-slug" value={audience.slug ?? ""} onChange={(e) => patchAudience({ slug: slugify(e.target.value) })} required /></FormField>
              </div>
              <FormField label="Description" htmlFor="au-desc" error={errors.description}><Textarea id="au-desc" value={audience.description ?? ""} onChange={(e) => patchAudience({ description: e.target.value })} maxLength={400} className="min-h-[70px]" /></FormField>
              <FormField label="Couleur" htmlFor="au-color" error={errors.color}><input id="au-color" type="color" value={audience.color ?? "#293241"} onChange={(e) => patchAudience({ color: e.target.value })} className="size-10 cursor-pointer rounded-lg border border-line" /></FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAudience(null)}>Annuler</Button>
                <Button type="submit" variant="admin" disabled={pending}>Enregistrer</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
