"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormField, FormSection, toLocalInput } from "@/components/admin/form-controls";
import { SearchSelect } from "@/components/admin/search-select";
import { UploadField } from "@/components/admin/upload-field";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteBlogPostAction, saveBlogPostAction } from "@/app/actions/admin/blog";
import { slugify } from "@/lib/utils";

interface PostView { id: string; title: string; slug: string; excerpt: string | null; content: string; coverImageUrl: string | null; tags: string[]; seoTitle: string | null; seoDescription: string | null; relatedProductIds: string[]; status: string; scheduledAt: string | null }

export function BlogPostForm({ post, products }: { post?: PostView; products: Array<{ id: string; name: string; slug: string }> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [cover, setCover] = useState(post?.coverImageUrl ?? "");
  const [related, setRelated] = useState<string[]>(post?.relatedProductIds ?? []);
  const [status, setStatus] = useState(post?.status ?? "DRAFT");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: fd.get("title"), slug: slug || null, excerpt: fd.get("excerpt"), content: fd.get("content"), coverImageUrl: cover || null,
      tags: fd.get("tags"), seoTitle: fd.get("seoTitle"), seoDescription: fd.get("seoDescription"), relatedProductIds: related, status: fd.get("status"), scheduledAt: fd.get("scheduledAt"),
    };
    start(async () => {
      const r = await saveBlogPostAction(post?.id ?? null, payload);
      if (r.ok) { toast.success("Article enregistré"); if (!post) router.push(`/admin/blog/${r.id}`); else router.refresh(); }
      else { setFields(r.fields ?? {}); toast.error(r.error); }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <FormSection title="Contenu">
          <FormField label="Titre" htmlFor="title" error={fields.title} required><Input id="title" name="title" value={title} onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} required /></FormField>
          <FormField label="Slug (URL)" htmlFor="slug" error={fields.slug} hint={`/blog/${slug || "…"}`}><Input id="slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} /></FormField>
          <FormField label="Extrait" htmlFor="excerpt" error={fields.excerpt}><Textarea id="excerpt" name="excerpt" defaultValue={post?.excerpt ?? ""} className="min-h-[70px]" maxLength={400} /></FormField>
          <FormField label="Contenu (markdown)" htmlFor="content" error={fields.content} required><Textarea id="content" name="content" defaultValue={post?.content ?? ""} className="min-h-[420px] font-mono text-sm" required /></FormField>
        </FormSection>
        <FormSection title="SEO">
          <FormField label="Titre SEO" htmlFor="seoTitle" error={fields.seoTitle}><Input id="seoTitle" name="seoTitle" defaultValue={post?.seoTitle ?? ""} maxLength={70} /></FormField>
          <FormField label="Meta description" htmlFor="seoDescription" error={fields.seoDescription}><Textarea id="seoDescription" name="seoDescription" defaultValue={post?.seoDescription ?? ""} className="min-h-[70px]" maxLength={170} /></FormField>
        </FormSection>
      </div>
      <div className="space-y-6">
        <FormSection title="Publication">
          <FormField label="Statut" htmlFor="status"><NativeSelect id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="DRAFT">Brouillon</option><option value="SCHEDULED">Programmé</option><option value="PUBLISHED">Publié</option><option value="ARCHIVED">Archivé</option></NativeSelect></FormField>
          {status === "SCHEDULED" && <FormField label="Date de publication" htmlFor="scheduledAt" error={fields.scheduledAt}><Input id="scheduledAt" name="scheduledAt" type="datetime-local" defaultValue={toLocalInput(post?.scheduledAt)} /></FormField>}
          <Button type="submit" variant="admin" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          {post && <ConfirmButton variant="ghost" size="sm" className="text-red-700" title="Supprimer cet article ?" confirmLabel="Supprimer" onConfirm={async () => { const r = await deleteBlogPostAction(post.id); if (r.ok) router.push("/admin/blog"); return r; }}>Supprimer l&apos;article</ConfirmButton>}
        </FormSection>
        <FormSection title="Image de couverture">
          {cover && <img src={cover} alt="" className="w-full rounded-xl object-cover" />}
          <UploadField scope="public" accept="image/*" label="Déposer une image" onUploaded={(f) => { if ("url" in f) setCover(f.url); }} />
          <Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="ou URL d'image" className="h-9 text-sm" />
        </FormSection>
        <FormSection title="Classement">
          <FormField label="Tags (séparés par des virgules)" htmlFor="tags"><Input id="tags" name="tags" defaultValue={post?.tags.join(", ") ?? ""} /></FormField>
          <FormField label="Produits liés"><SearchSelect options={products.map((p) => ({ value: p.id, label: p.name, hint: p.slug }))} value={related} onChange={setRelated} placeholder="Rechercher un produit…" /></FormField>
        </FormSection>
      </div>
    </form>
  );
}
