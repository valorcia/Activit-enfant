"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, FileText, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import { Icon } from "@/components/ui/icon";
import { FormField, FormSection, ListEditor } from "@/components/admin/form-controls";
import { eurosToCents } from "@/lib/admin/form-utils";
import type { ProductFormData, ProductFormFile, ProductFormImage } from "@/lib/admin/product-form-data";
export { emptyProductForm, productToForm } from "@/lib/admin/product-form-data";
import { SearchSelect, type SelectOption } from "@/components/admin/search-select";
import { UploadField, type UploadedPrivate, type UploadedPublic } from "@/components/admin/upload-field";
import { ConfirmButton } from "@/components/admin/confirm-button";
import type { FieldErrors } from "@/lib/admin/action-result";
import type { FaqItem, KitItem, SellingPoint } from "@/lib/schemas/product";
import { formatBytes, slugify } from "@/lib/utils";
import {
  addFileAction, addImageAction, addVideoAction, createProductAction, deleteProductAction, duplicateProductAction,
  removeFileAction, removeImageAction, reorderImagesAction, setStatusAction, updateFileAction, updateImageAction, updateProductAction,
} from "@/app/actions/admin/products";

export const TEMPLATES: Array<{ value: string; label: string; description: string }> = [
  { value: "ADVENTURE", label: "Aventure / chasse au trésor", description: "Hero immersif, histoire, contenu du kit d'aventure, carte au trésor." },
  { value: "ACTIVITY", label: "Cahier d'activités", description: "Mise en avant pédagogique, aperçu des pages, ce que l'enfant apprend." },
  { value: "STORY", label: "Histoire / e-book", description: "Présentation éditoriale, extrait de l'histoire, galerie de pages." },
  { value: "EVENT", label: "Kit événement", description: "Anniversaire, Noël, Pâques… : contenu du kit de fête et organisation." },
  { value: "CLASSIC", label: "Fiche classique", description: "Présentation standard, polyvalente." },
];

/** Onglet contenant chaque champ (pour afficher l'erreur au bon endroit). */
const FIELD_TABS: Record<string, string> = {
  name: "general", slug: "general", tagline: "general", shortDescription: "general", longDescription: "general", story: "general", template: "general", categoryId: "general", universe: "general",
  ageMin: "general", ageMax: "general", playersMin: "general", playersMax: "general", durationMinutes: "general", difficulty: "general", pageCount: "general", fileFormat: "general",
  priceCents: "prix", salePriceCents: "prix", creationCostCents: "prix", saleStartsAt: "prix", saleEndsAt: "prix", currency: "prix", taxRateBp: "prix",
  kitContents: "contenu", faq: "contenu", sellingPoints: "contenu",
  seoTitle: "marketing", seoDescription: "marketing", keywords: "marketing", ogImageUrl: "marketing", promoText: "marketing", recommendedProductIds: "marketing",
  status: "publication", scheduledAt: "publication",
};
const FIELD_LABELS: Record<string, string> = {
  name: "Nom", slug: "Slug", tagline: "Sous-titre", shortDescription: "Description courte", longDescription: "Description longue", story: "Histoire", ageMin: "Âge min", ageMax: "Âge max",
  priceCents: "Prix", salePriceCents: "Prix promo", saleStartsAt: "Début promo", saleEndsAt: "Fin promo", taxRateBp: "TVA", kitContents: "Contenu du kit", faq: "FAQ", sellingPoints: "Arguments",
  seoTitle: "Titre SEO", seoDescription: "Meta description", ogImageUrl: "Image OG", scheduledAt: "Date de publication",
};

const IMAGE_ROLES: Array<{ value: string; label: string }> = [
  { value: "MAIN", label: "Image principale" }, { value: "GALLERY", label: "Galerie" }, { value: "ILLUSTRATION", label: "Illustration immersive" },
  { value: "MOCKUP", label: "Mockup" }, { value: "PDF_PREVIEW", label: "Aperçu PDF (image)" }, { value: "OG", label: "Image Open Graph" },
];
const FILE_KINDS: Array<{ value: string; label: string }> = [
  { value: "MAIN_PDF", label: "PDF principal" }, { value: "EXTRA_PDF", label: "PDF complémentaire" }, { value: "INSTRUCTIONS", label: "Instructions" }, { value: "BONUS", label: "Bonus" },
];

function toPayload(f: ProductFormData) {
  const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  const taxBp = Math.round(Number(String(f.taxRate).replace(",", ".")) * 100);
  return {
    name: f.name, slug: f.slug ? slugify(f.slug) : undefined, tagline: f.tagline || null, shortDescription: f.shortDescription || null, longDescription: f.longDescription || null, story: f.story || null,
    template: f.template, categoryId: f.categoryId || null, collectionIds: f.collectionIds, universe: f.universe || null, tags: list(f.tags), badges: list(f.badges), heroBadges: list(f.heroBadges),
    ageMin: f.ageMin, ageMax: f.ageMax, playersMin: f.playersMin, playersMax: f.playersMax, durationMinutes: f.durationMinutes, difficulty: f.difficulty, pageCount: f.pageCount, fileFormat: f.fileFormat || "PDF", materials: list(f.materials),
    priceCents: eurosToCents(f.price) ?? -1, salePriceCents: eurosToCents(f.salePrice), saleStartsAt: f.saleStartsAt || undefined, saleEndsAt: f.saleEndsAt || undefined, currency: f.currency || "EUR", taxRateBp: Number.isFinite(taxBp) ? taxBp : 2000, creationCostCents: eurosToCents(f.creationCost),
    kitContents: f.kitContents, faq: f.faq, sellingPoints: f.sellingPoints,
    seoTitle: f.seoTitle || null, seoDescription: f.seoDescription || null, keywords: list(f.keywords), ogImageUrl: f.ogImageUrl || null, promoText: f.promoText || null, recommendedProductIds: f.recommendedProductIds,
    status: f.status, scheduledAt: f.scheduledAt || undefined, isFeatured: f.isFeatured,
  };
}

interface Props {
  initial: ProductFormData;
  images: ProductFormImage[];
  files: ProductFormFile[];
  categories: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; slug: string }>;
  siteUrl: string;
}

export function ProductForm({ initial, images, files, categories, collections, products, siteUrl }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormData>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  const [pending, start] = useTransition();
  const [videoUrl, setVideoUrl] = useState("");
  const [tab, setTab] = useState("general");
  const isNew = !form.id;

  const set = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => setForm((f) => ({ ...f, [key]: value }));
  const err = (k: string) => errors[k];
  const productOptions: SelectOption[] = useMemo(() => products.filter((p) => p.id !== form.id).map((p) => ({ value: p.id, label: p.name, hint: p.slug })), [products, form.id]);
  const collectionOptions: SelectOption[] = useMemo(() => collections.map((c) => ({ value: c.id, label: c.name })), [collections]);

  const priceCents = eurosToCents(form.price) ?? 0;
  const salePriceCents = eurosToCents(form.salePrice);
  const publicUrl = `${siteUrl}/aventures/${form.slug || slugify(form.name)}`;

  function submit(nextStatus?: string) {
    start(async () => {
      setErrors({});
      const payload = toPayload({ ...form, status: nextStatus ?? form.status });
      const res = isNew ? await createProductAction(payload) : await updateProductAction(form.id as string, payload);
      if (!res.ok) {
        const fe = res.fieldErrors ?? {};
        setErrors(fe);
        const keys = Object.keys(fe).filter((k) => k !== "_");
        if (keys.length) {
          setTab(FIELD_TABS[keys[0].split(".")[0]] ?? "general");
          toast.error(`${res.error} ${keys.map((k) => `${FIELD_LABELS[k.split(".")[0]] ?? k} : ${fe[k][0]}`).join(" · ")}`);
        } else toast.error(res.error);
        return;
      }
      toast.success(isNew ? "Produit créé — vous pouvez maintenant ajouter médias et fichiers." : "Produit enregistré.");
      if (isNew) router.push(`/admin/produits/${res.data.id}`);
      else { if (nextStatus) set("status", nextStatus); router.refresh(); }
    });
  }

  async function onImageUploaded(role: string, up: UploadedPublic | UploadedPrivate) {
    if (!("url" in up)) return;
    const res = await addImageAction(form.id as string, { url: up.url, key: up.key, role, width: up.width ?? null, height: up.height ?? null, alt: form.name });
    if (!res.ok) toast.error(res.error); else { toast.success("Image ajoutée"); router.refresh(); }
  }
  async function onFileUploaded(kind: string, up: UploadedPublic | UploadedPrivate) {
    if ("url" in up) return;
    const res = await addFileAction(form.id as string, { key: up.key, name: up.name, kind, mime: up.mime || "application/pdf", size: up.size });
    if (!res.ok) toast.error(res.error); else { toast.success("Fichier ajouté (stockage privé)"); router.refresh(); }
  }
  async function moveImage(index: number, dir: -1 | 1) {
    const sorted = [...images].sort((a, b) => a.position - b.position);
    const to = index + dir;
    if (to < 0 || to >= sorted.length) return;
    const [it] = sorted.splice(index, 1);
    sorted.splice(to, 0, it);
    const res = await reorderImagesAction(form.id as string, sorted.map((i) => i.id));
    if (!res.ok) toast.error(res.error); else router.refresh();
  }

  const sortedImages = [...images].sort((a, b) => a.position - b.position);
  const generalErrors = Object.entries(errors).filter(([k]) => k === "_").map(([, v]) => v).flat();

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-6">
      {/* Barre d'actions */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-[#F6F3EE]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mr-auto flex items-center gap-2">
          <StatusBadge status={form.status} />
          {form.needsReview && <Badge variant="warning">À valider (créé via API)</Badge>}
          {form.source === "duplicate" && <Badge variant="soft">Copie</Badge>}
        </div>
        {!isNew && (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={publicUrl} target="_blank"><ExternalLink className="size-4" /> Voir la fiche</Link>
          </Button>
        )}
        {!isNew && (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => start(async () => {
            const res = await duplicateProductAction(form.id as string);
            if (!res.ok) { toast.error(res.error); return; }
            toast.success("Copie créée en brouillon");
            router.push(`/admin/produits/${res.data.id}`);
          })}><Copy className="size-4" /> Dupliquer</Button>
        )}
        {!isNew && form.status !== "PUBLISHED" && (
          <Button type="button" variant="sage" size="sm" disabled={pending} onClick={() => submit("PUBLISHED")}>Publier</Button>
        )}
        {!isNew && form.status === "PUBLISHED" && (
          <Button type="button" variant="soft" size="sm" disabled={pending} onClick={() => submit("DRAFT")}>Dépublier</Button>
        )}
        <Button type="submit" variant="admin" size="sm" disabled={pending}><Save className="size-4" /> {pending ? "Enregistrement…" : isNew ? "Créer le brouillon" : "Enregistrer"}</Button>
      </div>

      {generalErrors.length > 0 && <Alert variant="danger">{generalErrors.join(" ")}</Alert>}
      {isNew && <Alert variant="info">Enregistrez d&apos;abord le brouillon : les médias et fichiers numériques s&apos;ajoutent ensuite, dans les onglets correspondants.</Alert>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="prix">Prix</TabsTrigger>
          <TabsTrigger value="medias" disabled={isNew}>Médias {images.length > 0 && `(${images.length})`}</TabsTrigger>
          <TabsTrigger value="fichiers" disabled={isNew}>Fichiers {files.length > 0 && `(${files.length})`}</TabsTrigger>
          <TabsTrigger value="contenu">Contenu</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="publication">Publication</TabsTrigger>
        </TabsList>

        {/* ----- Général ----- */}
        <TabsContent value="general" className="grid gap-6">
          <FormSection title="Informations générales">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Nom du produit" htmlFor="name" required error={err("name")}>
                <Input id="name" value={form.name} onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} required />
              </FormField>
              <FormField label="Slug (URL)" htmlFor="slug" hint={`/aventures/${form.slug || "…"}`} error={err("slug")}>
                <Input id="slug" value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} />
              </FormField>
            </div>
            <FormField label="Sous-titre (bénéfice principal)" htmlFor="tagline" error={err("tagline")}>
              <Input id="tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={200} />
            </FormField>
            <FormField label="Description courte" htmlFor="shortDescription" hint="Affichée dans les listes et aperçus (400 caractères max)." error={err("shortDescription")}>
              <Textarea id="shortDescription" value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} maxLength={400} className="min-h-[80px]" />
            </FormField>
            <FormField label="Description longue (markdown)" htmlFor="longDescription" error={err("longDescription")}>
              <Textarea id="longDescription" value={form.longDescription} onChange={(e) => set("longDescription", e.target.value)} className="min-h-[180px] font-mono text-sm" />
            </FormField>
            <FormField label="Histoire / présentation immersive (markdown)" htmlFor="story" hint="Ex. « La Capitaine Coquelicot a besoin de votre aide ! … »" error={err("story")}>
              <Textarea id="story" value={form.story} onChange={(e) => set("story", e.target.value)} className="min-h-[140px]" />
            </FormField>
          </FormSection>

          <FormSection title="Modèle de fiche produit" description="Chaque produit utilise le modèle de présentation le plus adapté.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((t) => (
                <label key={t.value} className={`cursor-pointer rounded-xl border-2 p-3 text-sm transition-colors ${form.template === t.value ? "border-coral bg-coral-light" : "border-line hover:border-ink/30"}`}>
                  <input type="radio" name="template" value={t.value} checked={form.template === t.value} onChange={() => set("template", t.value)} className="sr-only" />
                  <span className="block font-bold">{t.label}</span>
                  <span className="text-xs text-ink-soft">{t.description}</span>
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection title="Classement">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Catégorie" htmlFor="categoryId" error={err("categoryId")}>
                <NativeSelect id="categoryId" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  <option value="">— Aucune —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </FormField>
              <FormField label="Univers / thème" htmlFor="universe" hint="Pirates, Dinosaures, Espace…" error={err("universe")}>
                <Input id="universe" value={form.universe} onChange={(e) => set("universe", e.target.value)} />
              </FormField>
            </div>
            <FormField label="Collections" hint="Un produit peut appartenir à plusieurs collections.">
              <SearchSelect options={collectionOptions} value={form.collectionIds} onChange={(v) => set("collectionIds", v)} placeholder="Ajouter une collection…" />
            </FormField>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Tags (séparés par des virgules)" htmlFor="tags"><Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} /></FormField>
              <FormField label="Badges (cartes)" htmlFor="badges" hint="Ex. Nouveau, Best-seller"><Input id="badges" value={form.badges} onChange={(e) => set("badges", e.target.value)} /></FormField>
              <FormField label="Badges du hero" htmlFor="heroBadges" hint="Ex. PDF immédiat, Prêt à imprimer"><Input id="heroBadges" value={form.heroBadges} onChange={(e) => set("heroBadges", e.target.value)} /></FormField>
            </div>
          </FormSection>

          <FormSection title="Informations pratiques">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Âge minimum" htmlFor="ageMin" error={err("ageMin")}><Input id="ageMin" type="number" min={0} max={18} value={form.ageMin} onChange={(e) => set("ageMin", e.target.value)} /></FormField>
              <FormField label="Âge maximum" htmlFor="ageMax" error={err("ageMax")}><Input id="ageMax" type="number" min={0} max={18} value={form.ageMax} onChange={(e) => set("ageMax", e.target.value)} /></FormField>
              <FormField label="Joueurs min." htmlFor="playersMin" error={err("playersMin")}><Input id="playersMin" type="number" min={0} value={form.playersMin} onChange={(e) => set("playersMin", e.target.value)} /></FormField>
              <FormField label="Joueurs max." htmlFor="playersMax" error={err("playersMax")}><Input id="playersMax" type="number" min={0} value={form.playersMax} onChange={(e) => set("playersMax", e.target.value)} /></FormField>
              <FormField label="Durée (minutes)" htmlFor="durationMinutes" error={err("durationMinutes")}><Input id="durationMinutes" type="number" min={0} value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} /></FormField>
              <FormField label="Difficulté (1 à 5)" htmlFor="difficulty" error={err("difficulty")}>
                <NativeSelect id="difficulty" value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
                  <option value="">—</option>
                  <option value="1">1 · Très facile</option><option value="2">2 · Facile</option><option value="3">3 · Intermédiaire</option><option value="4">4 · Difficile</option><option value="5">5 · Expert</option>
                </NativeSelect>
              </FormField>
              <FormField label="Nombre de pages" htmlFor="pageCount" error={err("pageCount")}><Input id="pageCount" type="number" min={0} value={form.pageCount} onChange={(e) => set("pageCount", e.target.value)} /></FormField>
              <FormField label="Format" htmlFor="fileFormat" error={err("fileFormat")}><Input id="fileFormat" value={form.fileFormat} onChange={(e) => set("fileFormat", e.target.value)} /></FormField>
            </div>
            <FormField label="Matériel nécessaire (séparé par des virgules)" htmlFor="materials"><Input id="materials" value={form.materials} onChange={(e) => set("materials", e.target.value)} placeholder="imprimante, ciseaux, colle" /></FormField>
          </FormSection>
        </TabsContent>

        {/* ----- Prix ----- */}
        <TabsContent value="prix">
          <FormSection title="Prix" description="Prix TTC affichés aux clients. La TVA incluse est calculée pour la facturation.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Prix normal (€)" htmlFor="price" required error={err("priceCents")}><Input id="price" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="9,90" required /></FormField>
              <FormField label="Prix promotionnel (€)" htmlFor="salePrice" error={err("salePriceCents")} hint={salePriceCents && priceCents ? `-${Math.round((1 - salePriceCents / priceCents) * 100)} %` : undefined}><Input id="salePrice" inputMode="decimal" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} /></FormField>
              <FormField label="Devise" htmlFor="currency" error={err("currency")}>
                <NativeSelect id="currency" value={form.currency} onChange={(e) => set("currency", e.target.value)}><option value="EUR">EUR (€)</option><option value="CHF">CHF</option><option value="CAD">CAD</option><option value="USD">USD</option></NativeSelect>
              </FormField>
              <FormField label="TVA applicable (%)" htmlFor="taxRate" error={err("taxRateBp")}><Input id="taxRate" inputMode="decimal" value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)} /></FormField>
              <FormField label="Début de promotion" htmlFor="saleStartsAt" error={err("saleStartsAt")}><Input id="saleStartsAt" type="datetime-local" value={form.saleStartsAt} onChange={(e) => set("saleStartsAt", e.target.value)} /></FormField>
              <FormField label="Fin de promotion" htmlFor="saleEndsAt" error={err("saleEndsAt")}><Input id="saleEndsAt" type="datetime-local" value={form.saleEndsAt} onChange={(e) => set("saleEndsAt", e.target.value)} /></FormField>
              <FormField label="Coût de création (interne, €)" htmlFor="creationCost" error={err("creationCostCents")} hint="IA, illustrations, temps… Jamais affiché ; sert au calcul de la rentabilité (Marketing social)."><Input id="creationCost" inputMode="decimal" value={form.creationCost} onChange={(e) => set("creationCost", e.target.value)} placeholder="6,50" /></FormField>
            </div>
          </FormSection>
        </TabsContent>

        {/* ----- Médias ----- */}
        <TabsContent value="medias" className="grid gap-6">
          <FormSection title="Images" description="Image principale, galerie, illustrations immersives, mockups, aperçus PDF (exportés en image). Les images sont publiques.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[["MAIN", "Image principale"], ["GALLERY", "Galerie / aperçu"], ["ILLUSTRATION", "Illustration immersive"], ["MOCKUP", "Mockup"], ["PDF_PREVIEW", "Aperçu PDF (image)"], ["OG", "Image Open Graph"]].map(([role, label]) => (
                <UploadField key={role} scope="public" productId={form.id} accept="image/*" multiple={role !== "MAIN" && role !== "OG"} label={label} onUploaded={(up) => onImageUploaded(role, up)} />
              ))}
            </div>
            {sortedImages.filter((i) => i.role !== "VIDEO").length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedImages.filter((i) => i.role !== "VIDEO").map((img, idx) => (
                  <li key={img.id} className="rounded-xl border border-line bg-[#FBFAF7] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.alt ?? ""} className="aspect-[4/3] w-full rounded-lg object-cover" />
                    <div className="mt-2 grid gap-2">
                      <NativeSelect value={img.role} className="h-9 text-xs" aria-label="Rôle" onChange={async (e) => { const r = await updateImageAction(img.id, { role: e.target.value }); if (!r.ok) toast.error(r.error); else router.refresh(); }}>
                        {IMAGE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </NativeSelect>
                      <Input defaultValue={img.alt ?? ""} placeholder="Texte alternatif" className="h-9 text-xs" aria-label="Texte alternatif" onBlur={async (e) => { if (e.target.value !== (img.alt ?? "")) { const r = await updateImageAction(img.id, { alt: e.target.value }); if (!r.ok) toast.error(r.error); } }} />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Monter" onClick={() => moveImage(idx, -1)}><ArrowUp className="size-4" /></Button>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Descendre" onClick={() => moveImage(idx, 1)}><ArrowDown className="size-4" /></Button>
                        </div>
                        <ConfirmButton variant="ghost" size="icon-sm" className="text-red-600" title="Supprimer cette image ?" onConfirm={async () => { const r = await removeImageAction(img.id); if (r.ok) router.refresh(); return r; }}><Trash2 className="size-4" /></ConfirmButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
          <FormSection title="Vidéos" description="URL YouTube, Vimeo ou fichier .mp4 hébergé.">
            <div className="flex gap-2">
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" aria-label="URL de la vidéo" />
              <Button type="button" variant="soft" onClick={async () => { const r = await addVideoAction(form.id as string, videoUrl, form.name); if (!r.ok) toast.error(r.error); else { setVideoUrl(""); toast.success("Vidéo ajoutée"); router.refresh(); } }}>Ajouter</Button>
            </div>
            {sortedImages.filter((i) => i.role === "VIDEO").length > 0 && (
              <ul className="space-y-2 text-sm">
                {sortedImages.filter((i) => i.role === "VIDEO").map((v) => (
                  <li key={v.id} className="flex items-center justify-between rounded-xl border border-line bg-[#FBFAF7] px-3 py-2">
                    <a href={v.url} target="_blank" rel="noopener" className="truncate underline">{v.url}</a>
                    <ConfirmButton variant="ghost" size="icon-sm" className="text-red-600" title="Retirer cette vidéo ?" onConfirm={async () => { const r = await removeImageAction(v.id); if (r.ok) router.refresh(); return r; }}><Trash2 className="size-4" /></ConfirmButton>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
        </TabsContent>

        {/* ----- Fichiers ----- */}
        <TabsContent value="fichiers">
          <FormSection title="Fichiers numériques (payants)" description="Stockés dans l'espace privé : jamais d'URL publique. Livrés automatiquement après confirmation du paiement par Stripe.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FILE_KINDS.map((k) => (
                <UploadField key={k.value} scope="private" productId={form.id} accept=".pdf,.zip,application/pdf,application/zip" multiple label={k.label} onUploaded={(up) => onFileUploaded(k.value, up)} />
              ))}
            </div>
            {files.length === 0 ? (
              <Alert variant="warning">Aucun fichier : le produit ne pourra rien livrer. Ajoutez au moins le PDF principal avant publication.</Alert>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-white">
                {files.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <FileText className="size-5 text-ink-muted" />
                    <div className="min-w-0 flex-1">
                      <Input defaultValue={f.name} className="h-9 text-sm font-semibold" aria-label="Nom du fichier" onBlur={async (e) => { if (e.target.value && e.target.value !== f.name) { const r = await updateFileAction(f.id, { name: e.target.value }); if (!r.ok) toast.error(r.error); } }} />
                      <p className="mt-1 text-xs text-ink-muted">{formatBytes(f.sizeBytes)} · {f.mime}</p>
                    </div>
                    <NativeSelect defaultValue={f.kind} className="h-9 w-44 text-xs" aria-label="Type" onChange={async (e) => { const r = await updateFileAction(f.id, { kind: e.target.value }); if (!r.ok) toast.error(r.error); }}>
                      {FILE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </NativeSelect>
                    <Button type="button" variant="outline" size="sm" asChild><a href={`/api/admin/files/${f.id}`} target="_blank" rel="noopener">Télécharger (admin)</a></Button>
                    <ConfirmButton variant="ghost" size="icon-sm" className="text-red-600" title="Supprimer ce fichier ?" description="Les clients ayant déjà acheté ne pourront plus le télécharger." onConfirm={async () => { const r = await removeFileAction(f.id); if (r.ok) router.refresh(); return r; }}><Trash2 className="size-4" /></ConfirmButton>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
        </TabsContent>

        {/* ----- Contenu ----- */}
        <TabsContent value="contenu" className="grid gap-6">
          <FormSection title="Contenu du kit" description="Les éléments affichés doivent correspondre exactement au contenu réel du produit.">
            <ListEditor<KitItem> items={form.kitContents} onChange={(v) => set("kitContents", v)} addLabel="Ajouter un élément" create={() => ({ title: "", description: "", icon: "file-text" })}
              renderItem={(it, update) => (
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_80px]">
                  <Input value={it.title} onChange={(e) => update({ title: e.target.value })} placeholder="Titre (ex. Carte au trésor)" aria-label="Titre" />
                  <Input value={it.description ?? ""} onChange={(e) => update({ description: e.target.value })} placeholder="Description" aria-label="Description" />
                  <div className="flex items-center gap-1"><Icon name={it.icon ?? "file-text"} className="size-4 shrink-0" /><Input value={it.icon ?? ""} onChange={(e) => update({ icon: e.target.value })} placeholder="icône" aria-label="Icône lucide" /></div>
                  <Input type="number" min={0} value={it.quantity ?? ""} onChange={(e) => update({ quantity: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Qté" aria-label="Quantité" />
                </div>
              )} />
          </FormSection>
          <FormSection title="Arguments commerciaux" description="Laissez vide pour utiliser les arguments par défaut (simplicité, originalité, moments partagés, impression à domicile, téléchargement immédiat).">
            <ListEditor<SellingPoint> items={form.sellingPoints} onChange={(v) => set("sellingPoints", v)} addLabel="Ajouter un argument" create={() => ({ title: "", description: "", icon: "sparkles" })}
              renderItem={(it, update) => (
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_120px]">
                  <Input value={it.title} onChange={(e) => update({ title: e.target.value })} placeholder="Titre" aria-label="Titre" />
                  <Input value={it.description ?? ""} onChange={(e) => update({ description: e.target.value })} placeholder="Description" aria-label="Description" />
                  <div className="flex items-center gap-1"><Icon name={it.icon ?? "sparkles"} className="size-4 shrink-0" /><Input value={it.icon ?? ""} onChange={(e) => update({ icon: e.target.value })} placeholder="icône" aria-label="Icône lucide" /></div>
                </div>
              )} />
          </FormSection>
          <FormSection title="FAQ produit">
            <ListEditor<FaqItem> items={form.faq} onChange={(v) => set("faq", v)} addLabel="Ajouter une question" create={() => ({ question: "", answer: "" })}
              renderItem={(it, update) => (
                <div className="grid gap-2">
                  <Input value={it.question} onChange={(e) => update({ question: e.target.value })} placeholder="Question" aria-label="Question" />
                  <Textarea value={it.answer} onChange={(e) => update({ answer: e.target.value })} placeholder="Réponse" aria-label="Réponse" className="min-h-[70px]" />
                </div>
              )} />
          </FormSection>
        </TabsContent>

        {/* ----- Marketing ----- */}
        <TabsContent value="marketing" className="grid gap-6">
          <FormSection title="SEO">
            <FormField label="Titre SEO" htmlFor="seoTitle" hint={`${form.seoTitle.length}/70 caractères`} error={err("seoTitle")}><Input id="seoTitle" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={70} /></FormField>
            <FormField label="Meta description" htmlFor="seoDescription" hint={`${form.seoDescription.length}/170 caractères`} error={err("seoDescription")}><Textarea id="seoDescription" value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={170} className="min-h-[70px]" /></FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Mots-clés internes (virgules)" htmlFor="keywords"><Input id="keywords" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} /></FormField>
              <FormField label="Image Open Graph (URL)" htmlFor="ogImageUrl" hint="Ou ajoutez une image avec le rôle « Open Graph » dans Médias." error={err("ogImageUrl")}><Input id="ogImageUrl" value={form.ogImageUrl} onChange={(e) => set("ogImageUrl", e.target.value)} /></FormField>
            </div>
            <div className="rounded-xl bg-[#FBFAF7] p-3 text-sm">
              <p className="text-xs font-bold uppercase text-ink-muted">Aperçu Google</p>
              <p className="mt-1 text-[#1a0dab] text-base">{form.seoTitle || form.name || "Titre du produit"}</p>
              <p className="text-xs text-emerald-700">{publicUrl}</p>
              <p className="text-ink-soft">{form.seoDescription || form.shortDescription || "Meta description…"}</p>
            </div>
          </FormSection>
          <FormSection title="Promotion et recommandations">
            <FormField label="Texte promotionnel" htmlFor="promoText" hint="Affiché près du prix (ex. « Offre de lancement »)."><Input id="promoText" value={form.promoText} onChange={(e) => set("promoText", e.target.value)} maxLength={300} /></FormField>
            <FormField label="Produits recommandés" hint="Affichés en « Vous aimerez aussi » (sinon sélection automatique).">
              <SearchSelect options={productOptions} value={form.recommendedProductIds} onChange={(v) => set("recommendedProductIds", v)} placeholder="Rechercher un produit…" max={8} />
            </FormField>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-coral" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} /> Mettre en avant sur la page d&apos;accueil</label>
          </FormSection>
        </TabsContent>

        {/* ----- Publication ----- */}
        <TabsContent value="publication">
          <FormSection title="Publication">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[["DRAFT", "Brouillon", "Non visible sur le site."], ["SCHEDULED", "Programmé", "Publié automatiquement à la date choisie."], ["PUBLISHED", "Publié", "Visible et achetable."], ["ARCHIVED", "Archivé", "Retiré de la vente, commandes conservées."]].map(([v, l, d]) => (
                <label key={v} className={`cursor-pointer rounded-xl border-2 p-3 text-sm ${form.status === v ? "border-ink bg-ink text-white" : "border-line hover:border-ink/30"}`}>
                  <input type="radio" name="status" value={v} checked={form.status === v} onChange={() => set("status", v)} className="sr-only" />
                  <span className="block font-bold">{l}</span>
                  <span className={`text-xs ${form.status === v ? "text-white/80" : "text-ink-soft"}`}>{d}</span>
                </label>
              ))}
            </div>
            {form.status === "SCHEDULED" && (
              <FormField label="Date et heure de publication" htmlFor="scheduledAt" required error={err("scheduledAt")}><Input id="scheduledAt" type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} className="max-w-xs" /></FormField>
            )}
            {form.publishedAt && <p className="text-sm text-ink-soft">Première publication : {new Date(form.publishedAt).toLocaleString("fr-FR")}</p>}
            <p className="text-sm">Lien public : <a href={publicUrl} target="_blank" rel="noopener" className="underline">{publicUrl}</a></p>
            {!isNew && (
              <div className="border-t border-line pt-4">
                <ConfirmButton variant="danger" size="sm" title="Supprimer ce produit ?" description="S'il a déjà été vendu, il sera archivé (les commandes historiques sont conservées)." confirmLabel="Supprimer"
                  onConfirm={async () => { const r = await deleteProductAction(form.id as string); if (r.ok) { toast.success(r.data.archived ? "Produit archivé (déjà vendu)" : "Produit supprimé"); router.push("/admin/produits"); } return r; }}>
                  <Trash2 className="size-4" /> Supprimer le produit
                </ConfirmButton>
              </div>
            )}
          </FormSection>
        </TabsContent>
      </Tabs>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const v = { DRAFT: "soft", SCHEDULED: "sky", PUBLISHED: "sage", ARCHIVED: "outline" }[status] as "soft" | "sky" | "sage" | "outline" | undefined;
  const l = { DRAFT: "Brouillon", SCHEDULED: "Programmé", PUBLISHED: "Publié", ARCHIVED: "Archivé" }[status] ?? status;
  return <Badge variant={v ?? "soft"}>{l}</Badge>;
}

