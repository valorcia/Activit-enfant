"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { FormField } from "@/components/admin/form-controls";
import { UploadField } from "@/components/admin/upload-field";
import { ConfirmButton } from "@/components/admin/confirm-button";
import type { ActionResult, FieldErrors } from "@/lib/admin/action-result";
import { slugify } from "@/lib/utils";

export interface TaxonomyItem {
  id: string; name: string; slug: string; description: string | null; imageUrl: string | null; color: string | null; icon?: string | null;
  position: number; isVisible: boolean; seoTitle: string | null; seoDescription: string | null; parentId?: string | null; productCount: number;
}

interface Props {
  kind: "category" | "collection";
  items: TaxonomyItem[];
  save: (id: string | null, data: Record<string, unknown>) => Promise<ActionResult<{ id: string }>>;
  remove: (id: string) => Promise<ActionResult<undefined>>;
  reorder: (ids: string[]) => Promise<ActionResult<undefined>>;
}

const BRAND_COLORS = ["#FF826F", "#FFD66B", "#A8C9A1", "#A9D8F5", "#C8B6E8", "#293241"];

export function TaxonomyManager({ kind, items, save, remove, reorder }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<TaxonomyItem> | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  const isCategory = kind === "category";
  const label = isCategory ? "catégorie" : "collection";
  const publicBase = isCategory ? "/categories/" : "/collections/";

  function move(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= items.length) return;
    const ids = items.map((i) => i.id);
    const [it] = ids.splice(index, 1);
    ids.splice(to, 0, it);
    start(async () => { const r = await reorder(ids); if (!r.ok) toast.error(r.error); else router.refresh(); });
  }

  function submit() {
    if (!editing) return;
    start(async () => {
      setErrors({});
      const payload: Record<string, unknown> = {
        name: editing.name ?? "", slug: editing.slug ? slugify(editing.slug) : undefined, description: editing.description ?? "", color: editing.color ?? "",
        position: editing.position ?? items.length, isVisible: editing.isVisible ?? true, seoTitle: editing.seoTitle ?? "", seoDescription: editing.seoDescription ?? "",
      };
      if (isCategory) { payload.illustrationUrl = editing.imageUrl ?? ""; payload.icon = editing.icon ?? ""; payload.parentId = editing.parentId ?? ""; }
      else payload.imageUrl = editing.imageUrl ?? "";
      const r = await save(editing.id ?? null, payload);
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
      toast.success(`${isCategory ? "Catégorie" : "Collection"} enregistrée`);
      setEditing(null);
      router.refresh();
    });
  }

  const set = (patch: Partial<TaxonomyItem>) => setEditing((e) => ({ ...(e ?? {}), ...patch }));

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="admin" size="sm" onClick={() => setEditing({ isVisible: true, color: BRAND_COLORS[items.length % BRAND_COLORS.length], position: items.length })}><Plus className="size-4" /> Nouvelle {label}</Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center text-sm text-ink-soft">Aucune {label} pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={it.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: it.color ?? "#293241" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.imageUrl ? <img src={it.imageUrl} alt="" className="size-10 rounded-xl object-cover" /> : <Icon name={it.icon ?? "sparkles"} className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{it.name} {!it.isVisible && <span className="ml-1 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-bold uppercase">Masquée</span>}</p>
                <p className="truncate text-xs text-ink-muted">{publicBase}{it.slug} · {it.productCount} produit{it.productCount > 1 ? "s" : ""}{it.parentId ? ` · sous-catégorie de ${items.find((p) => p.id === it.parentId)?.name ?? "?"}` : ""}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Monter" disabled={i === 0 || pending} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Descendre" disabled={i === items.length - 1 || pending} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Modifier" onClick={() => setEditing(it)}><Pencil className="size-4" /></Button>
                <ConfirmButton variant="ghost" size="icon-sm" className="text-red-600" title={`Supprimer « ${it.name} » ?`} description={isCategory ? "Les produits associés ne seront pas supprimés (ils perdront leur catégorie)." : "Les produits associés ne seront pas supprimés."} onConfirm={async () => { const r = await remove(it.id); if (r.ok) router.refresh(); return r; }}><Trash2 className="size-4" /></ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? `Modifier la ${label}` : `Nouvelle ${label}`}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nom" htmlFor="tx-name" required error={errors.name}><Input id="tx-name" value={editing.name ?? ""} onChange={(e) => set({ name: e.target.value, slug: editing.id ? editing.slug : slugify(e.target.value) })} required /></FormField>
                <FormField label="Slug" htmlFor="tx-slug" error={errors.slug}><Input id="tx-slug" value={editing.slug ?? ""} onChange={(e) => set({ slug: slugify(e.target.value) })} /></FormField>
              </div>
              <FormField label="Description courte" htmlFor="tx-desc" error={errors.description}><Textarea id="tx-desc" value={editing.description ?? ""} onChange={(e) => set({ description: e.target.value })} className="min-h-[70px]" maxLength={400} /></FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Couleur distinctive" htmlFor="tx-color" error={errors.color}>
                  <div className="flex items-center gap-2">
                    <input id="tx-color" type="color" value={editing.color ?? "#FF826F"} onChange={(e) => set({ color: e.target.value })} className="size-10 cursor-pointer rounded-lg border border-line" />
                    <div className="flex gap-1">{BRAND_COLORS.map((c) => <button key={c} type="button" aria-label={c} className="size-6 rounded-full border border-white shadow" style={{ background: c }} onClick={() => set({ color: c })} />)}</div>
                  </div>
                </FormField>
                {isCategory ? (
                  <FormField label="Icône (nom lucide)" htmlFor="tx-icon" hint="Ex. map, pencil-ruler, party-popper, book-open" error={errors.icon}>
                    <div className="flex items-center gap-2"><Icon name={editing.icon ?? "sparkles"} className="size-5" /><Input id="tx-icon" value={editing.icon ?? ""} onChange={(e) => set({ icon: e.target.value })} /></div>
                  </FormField>
                ) : null}
                {isCategory && (
                  <FormField label="Catégorie parente" htmlFor="tx-parent">
                    <NativeSelect id="tx-parent" value={editing.parentId ?? ""} onChange={(e) => set({ parentId: e.target.value || null })}>
                      <option value="">— Aucune (niveau principal) —</option>
                      {items.filter((p) => p.id !== editing.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </NativeSelect>
                  </FormField>
                )}
              </div>
              <FormField label="Illustration" error={errors.illustrationUrl ?? errors.imageUrl}>
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {editing.imageUrl && <img src={editing.imageUrl} alt="" className="size-20 rounded-xl object-cover" />}
                  <div className="flex-1"><UploadField scope="public" productId={`taxonomy-${kind}`} accept="image/*" label="Déposer une illustration" onUploaded={(up) => { if ("url" in up) set({ imageUrl: up.url }); }} /></div>
                </div>
                {editing.imageUrl && <Button type="button" variant="link" size="sm" className="px-0" onClick={() => set({ imageUrl: null })}>Retirer l&apos;illustration</Button>}
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Titre SEO" htmlFor="tx-seo-title" error={errors.seoTitle}><Input id="tx-seo-title" value={editing.seoTitle ?? ""} onChange={(e) => set({ seoTitle: e.target.value })} maxLength={70} /></FormField>
                <FormField label="Meta description" htmlFor="tx-seo-desc" error={errors.seoDescription}><Input id="tx-seo-desc" value={editing.seoDescription ?? ""} onChange={(e) => set({ seoDescription: e.target.value })} maxLength={170} /></FormField>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-coral" checked={editing.isVisible ?? true} onChange={(e) => set({ isVisible: e.target.checked })} /> Visible sur le site</label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
                <Button type="submit" variant="admin" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
