"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormField, FormSection } from "@/components/admin/form-controls";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Alert } from "@/components/ui/misc";
import { deleteStaticPageAction, saveStaticPageAction } from "@/app/actions/admin/pages";
import { slugify } from "@/lib/utils";

interface PageView { id: string; title: string; slug: string; content: string; status: string; showInFooter: boolean; position: number; seoTitle: string | null; seoDescription: string | null }

export function StaticPageForm({ page }: { page?: PageView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [touched, setTouched] = useState(!!page);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = { title: fd.get("title"), slug, content: fd.get("content"), status: fd.get("status"), showInFooter: fd.get("showInFooter") === "on", position: fd.get("position"), seoTitle: fd.get("seoTitle"), seoDescription: fd.get("seoDescription") };
    start(async () => {
      const r = await saveStaticPageAction(page?.id ?? null, payload);
      if (r.ok) { toast.success("Page enregistrée"); if (!page) router.push(`/admin/pages/${r.id}`); else router.refresh(); }
      else { setFields(r.fields ?? {}); toast.error(r.error); }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <Alert variant="warning">Textes juridiques à valider avant mise en production : ne publiez une page juridique qu&apos;après validation.</Alert>
        <FormSection title="Contenu">
          <FormField label="Titre" htmlFor="title" error={fields.title} required><Input id="title" name="title" defaultValue={page?.title ?? ""} onChange={(e) => !touched && setSlug(slugify(e.target.value))} required /></FormField>
          <FormField label="Slug" htmlFor="slug" error={fields.slug} hint={`/pages/${slug || "…"}`}><Input id="slug" value={slug} onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }} /></FormField>
          <FormField label="Contenu (markdown)" htmlFor="content" error={fields.content}><Textarea id="content" name="content" defaultValue={page?.content ?? ""} className="min-h-[460px] font-mono text-sm" /></FormField>
        </FormSection>
        <FormSection title="SEO">
          <FormField label="Titre SEO" htmlFor="seoTitle"><Input id="seoTitle" name="seoTitle" defaultValue={page?.seoTitle ?? ""} maxLength={70} /></FormField>
          <FormField label="Meta description" htmlFor="seoDescription"><Textarea id="seoDescription" name="seoDescription" defaultValue={page?.seoDescription ?? ""} className="min-h-[70px]" maxLength={170} /></FormField>
        </FormSection>
      </div>
      <div className="space-y-6">
        <FormSection title="Publication">
          <FormField label="Statut" htmlFor="status"><NativeSelect id="status" name="status" defaultValue={page?.status ?? "DRAFT"}><option value="DRAFT">Brouillon</option><option value="PUBLISHED">Publiée</option><option value="ARCHIVED">Archivée</option></NativeSelect></FormField>
          <FormField label="Position dans le pied de page" htmlFor="position"><Input id="position" name="position" type="number" min={0} defaultValue={page?.position ?? 0} /></FormField>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="showInFooter" defaultChecked={page?.showInFooter ?? true} className="size-4 accent-coral" /> Afficher dans le pied de page</label>
          <Button type="submit" variant="admin" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          {page && <ConfirmButton variant="ghost" size="sm" className="text-red-700" title="Supprimer cette page ?" confirmLabel="Supprimer" onConfirm={async () => { const r = await deleteStaticPageAction(page.id); if (r.ok) router.push("/admin/pages"); return r; }}>Supprimer</ConfirmButton>}
        </FormSection>
      </div>
    </form>
  );
}
