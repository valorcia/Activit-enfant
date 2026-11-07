"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormField, FormSection } from "@/components/admin/form-controls";
import { eurosToCents } from "@/lib/admin/form-utils";
import type { BundleFormData, BundleProductOption } from "@/lib/admin/bundle-form-data";
export { emptyBundleForm, bundleToForm } from "@/lib/admin/bundle-form-data";
import { SearchSelect } from "@/components/admin/search-select";
import { UploadField } from "@/components/admin/upload-field";
import { ConfirmButton } from "@/components/admin/confirm-button";
import type { FieldErrors } from "@/lib/admin/action-result";
import { saveBundleAction, deleteBundleAction } from "@/app/actions/admin/bundles";
import { formatPrice, slugify } from "@/lib/utils";

export function BundleForm({ initial, products, siteUrl }: { initial: BundleFormData; products: BundleProductOption[]; siteUrl: string }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  const [pending, start] = useTransition();
  const set = <K extends keyof BundleFormData>(k: K, v: BundleFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  const options = useMemo(() => products.map((p) => ({ value: p.id, label: p.name, hint: `${formatPrice(p.priceCents)} · ${p.status === "PUBLISHED" ? "publié" : p.status.toLowerCase()}` })), [products]);
  const sum = form.productIds.reduce((s, id) => s + (products.find((p) => p.id === id)?.priceCents ?? 0), 0);
  const price = eurosToCents(form.price) ?? 0;
  const savings = Math.max(0, sum - price);
  const unpublished = form.productIds.filter((id) => products.find((p) => p.id === id)?.status !== "PUBLISHED");

  function submit() {
    start(async () => {
      setErrors({});
      const payload = { ...form, slug: form.slug ? slugify(form.slug) : undefined, priceCents: eurosToCents(form.price) ?? -1, taxRateBp: Math.round(Number(form.taxRate.replace(",", ".")) * 100) };
      const r = await saveBundleAction(form.id ?? null, payload);
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
      toast.success("Pack enregistré");
      if (!form.id) router.push(`/admin/packs/${r.data.id}`); else router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        {form.id && <Button type="button" variant="outline" size="sm" asChild><a href={`${siteUrl}/packs/${form.slug}`} target="_blank" rel="noopener">Voir le pack</a></Button>}
        <Button type="submit" variant="admin" size="sm" disabled={pending}><Save className="size-4" /> {pending ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
      <FormSection title="Présentation">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Nom du pack" htmlFor="b-name" required error={errors.name}><Input id="b-name" value={form.name} onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} required /></FormField>
          <FormField label="Slug" htmlFor="b-slug" hint={`/packs/${form.slug || "…"}`} error={errors.slug}><Input id="b-slug" value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} /></FormField>
        </div>
        <FormField label="Accroche" htmlFor="b-tagline" error={errors.tagline}><Input id="b-tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={200} /></FormField>
        <FormField label="Description (markdown)" htmlFor="b-desc" error={errors.description}><Textarea id="b-desc" value={form.description} onChange={(e) => set("description", e.target.value)} /></FormField>
        <FormField label="Image du pack" error={errors.imageUrl}>
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {form.imageUrl && <img src={form.imageUrl} alt="" className="size-24 rounded-xl object-cover" />}
            <div className="flex-1"><UploadField scope="public" productId={`bundle-${form.id ?? "nouveau"}`} accept="image/*" label="Déposer une image" onUploaded={(up) => { if ("url" in up) set("imageUrl", up.url); }} /></div>
          </div>
        </FormField>
        <FormField label="Badges (virgules)" htmlFor="b-badges"><Input id="b-badges" value={form.badges} onChange={(e) => set("badges", e.target.value)} placeholder="Offre groupée, -25 %" /></FormField>
      </FormSection>

      <FormSection title="Produits inclus" description="Le client reçoit tous les fichiers des produits inclus.">
        <FormField label="Sélection" error={errors.productIds}><SearchSelect options={options} value={form.productIds} onChange={(v) => set("productIds", v)} placeholder="Rechercher un produit à inclure…" /></FormField>
        {unpublished.length > 0 && <p className="text-xs font-semibold text-honey-dark">Attention : {unpublished.length} produit{unpublished.length > 1 ? "s" : ""} inclus n&apos;est pas publié.</p>}
      </FormSection>

      <FormSection title="Prix groupé">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Prix du pack (€ TTC)" htmlFor="b-price" required error={errors.priceCents}><Input id="b-price" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} required /></FormField>
          <FormField label="Devise" htmlFor="b-currency"><NativeSelect id="b-currency" value={form.currency} onChange={(e) => set("currency", e.target.value)}><option value="EUR">EUR</option><option value="CHF">CHF</option><option value="CAD">CAD</option><option value="USD">USD</option></NativeSelect></FormField>
          <FormField label="TVA (%)" htmlFor="b-tax" error={errors.taxRateBp}><Input id="b-tax" inputMode="decimal" value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)} /></FormField>
        </div>
        <div className="rounded-xl bg-[#FBFAF7] p-3 text-sm">
          <p>Somme des prix individuels : <strong>{formatPrice(sum)}</strong></p>
          <p>Prix du pack : <strong>{formatPrice(price)}</strong> → économie <strong className="text-sage-dark">{formatPrice(savings)}</strong>{sum > 0 && ` (${Math.round((savings / sum) * 100)} %)`}</p>
          {price > sum && sum > 0 && <p className="font-semibold text-red-600">Le pack est plus cher que les produits séparés.</p>}
        </div>
      </FormSection>

      <FormSection title="Publication et SEO">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Statut" htmlFor="b-status"><NativeSelect id="b-status" value={form.status} onChange={(e) => set("status", e.target.value)}><option value="DRAFT">Brouillon</option><option value="PUBLISHED">Publié</option><option value="ARCHIVED">Archivé</option></NativeSelect></FormField>
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold"><input type="checkbox" className="size-4 accent-coral" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} /> Mettre en avant</label>
          <FormField label="Titre SEO" htmlFor="b-seo-t" error={errors.seoTitle}><Input id="b-seo-t" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={70} /></FormField>
          <FormField label="Meta description" htmlFor="b-seo-d" error={errors.seoDescription}><Input id="b-seo-d" value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={170} /></FormField>
        </div>
        {form.id && (
          <div className="border-t border-line pt-4">
            <ConfirmButton variant="danger" size="sm" title="Supprimer ce pack ?" description="S'il a déjà été vendu, il sera archivé." onConfirm={async () => { const r = await deleteBundleAction(form.id as string); if (r.ok) router.push("/admin/packs"); return r; }}><Trash2 className="size-4" /> Supprimer le pack</ConfirmButton>
          </div>
        )}
      </FormSection>
    </form>
  );
}

