"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Send, Save, Trash2, X } from "lucide-react";
import { saveSubmissionAction } from "@/app/actions/creator";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { uploadCreatorImage } from "./image-upload";
import type { SubmissionFormValue } from "./submission-value";

export function SubmissionForm({ id, initial, minPhotos, maxPhotos, rates }: { id: string | null; initial: SubmissionFormValue; minPhotos: number; maxPhotos: number; rates: { idea: string; full: string; bonus: string } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof SubmissionFormValue>(k: K, val: SubmissionFormValue[K]) => setV((cur) => ({ ...cur, [k]: val }));

  async function addFiles(files: FileList) {
    const room = maxPhotos - v.photos.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) toast.warning(`${maxPhotos} photos au maximum : ${files.length - room} photo(s) ignorée(s)`);
    for (const file of list) {
      setUploading((n) => n + 1);
      try {
        const up = await uploadCreatorImage(file, "photo");
        const preview = URL.createObjectURL(file);
        setV((cur) => ({ ...cur, photos: [...cur.photos, { key: up.key, width: up.width, height: up.height, size: up.size, preview }] }));
      } catch (e) {
        toast.error(`${file.name} : ${e instanceof Error ? e.message : "échec de l'envoi"}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= v.photos.length) return;
    const next = [...v.photos];
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p);
    set("photos", next);
  };

  function submit(sendForReview: boolean) {
    setProblem(null);
    const payload = {
      title: v.title, ageMin: v.ageMin, ageMax: v.ageMax, durationMinutes: v.durationMinutes,
      materials: v.materials.split("\n"), steps: v.steps, tips: v.tips, safetyNotes: v.safetyNotes,
      contribution: v.contribution, exclusive: v.exclusive, photos: v.photos.map(({ preview: _p, ...p }) => p),
    };
    start(async () => {
      const r = await saveSubmissionAction(id, payload, sendForReview);
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); setProblem(r.error); toast.error(r.error); return; }
      setErrors({});
      toast.success(sendForReview ? "Idée envoyée ! Nous revenons vers vous rapidement." : "Brouillon enregistré");
      if (!id || sendForReview) router.push(`/espace-createur/idees/${r.data.id}`);
      router.refresh();
    });
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit(true); }}>
      <section className="card-soft space-y-4 p-5 sm:p-6">
        <h2 className="font-heading text-xl font-bold">Votre idée</h2>
        <Field label="Titre" htmlFor="s-title" error={err("title")} hint="Ex. « Le hérisson dans sa bulle de verre »"><Input id="s-title" value={v.title} onChange={(e) => set("title", e.target.value)} required maxLength={120} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Âge min." htmlFor="s-agemin" error={err("ageMin")}><Input id="s-agemin" type="number" inputMode="numeric" min={0} max={18} value={v.ageMin} onChange={(e) => set("ageMin", e.target.value)} /></Field>
          <Field label="Âge max." htmlFor="s-agemax" error={err("ageMax")}><Input id="s-agemax" type="number" inputMode="numeric" min={0} max={18} value={v.ageMax} onChange={(e) => set("ageMax", e.target.value)} /></Field>
          <Field label="Durée (min)" htmlFor="s-duration" error={err("durationMinutes")}><Input id="s-duration" type="number" inputMode="numeric" min={5} max={600} value={v.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} /></Field>
        </div>
        <Field label="Matériel" htmlFor="s-materials" hint="Un élément par ligne" error={err("materials")}><Textarea id="s-materials" value={v.materials} onChange={(e) => set("materials", e.target.value)} placeholder={"Un pot en verre\nDe la mousse\nDes pommes de pin"} /></Field>
      </section>

      <section className="card-soft space-y-4 p-5 sm:p-6">
        <h2 className="font-heading text-xl font-bold">Les étapes</h2>
        <ol className="space-y-3">
          {v.steps.map((step, i) => (
            <li key={i} className="rounded-2xl border border-line bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Étape {i + 1}</span>
                <span className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Monter" disabled={i === 0} onClick={() => { const s = [...v.steps]; [s[i - 1], s[i]] = [s[i], s[i - 1]]; set("steps", s); }}><ArrowUp className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Descendre" disabled={i === v.steps.length - 1} onClick={() => { const s = [...v.steps]; [s[i + 1], s[i]] = [s[i], s[i + 1]]; set("steps", s); }}><ArrowDown className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Supprimer l'étape" className="text-red-600" disabled={v.steps.length <= 1} onClick={() => set("steps", v.steps.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                </span>
              </div>
              <Textarea aria-label={`Étape ${i + 1}`} value={step} onChange={(e) => set("steps", v.steps.map((s, j) => (j === i ? e.target.value : s)))} className="min-h-[80px]" maxLength={1500} />
            </li>
          ))}
        </ol>
        {v.steps.length < 30 && <Button type="button" variant="soft" size="sm" onClick={() => set("steps", [...v.steps, ""])}><Plus className="size-4" /> Ajouter une étape</Button>}
        <Field label="Astuces (facultatif)" htmlFor="s-tips"><Textarea id="s-tips" value={v.tips} onChange={(e) => set("tips", e.target.value)} maxLength={3000} placeholder="Ce qui a bien marché, les variantes…" /></Field>
        <Field label="Consignes de sécurité" htmlFor="s-safety" hint="Verre, chaleur, outils, petites pièces avant 3 ans… : indiquez ce qui doit se faire avec un adulte."><Textarea id="s-safety" value={v.safetyNotes} onChange={(e) => set("safetyNotes", e.target.value)} maxLength={3000} /></Field>
      </section>

      <section className="card-soft space-y-4 p-5 sm:p-6">
        <h2 className="font-heading text-xl font-bold">Vos photos <span className="text-base font-semibold text-ink-muted">({v.photos.length}/{maxPhotos})</span></h2>
        <p className="text-sm text-ink-soft">De {minPhotos} à {maxPhotos} photos de votre réalisation. <strong>Mains et réalisation uniquement</strong> : pas de visage d&apos;enfant reconnaissable. Les photos restent privées : seule notre équipe les voit.</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {v.photos.map((p, i) => (
            <li key={p.key} className="group relative aspect-square overflow-hidden rounded-2xl bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold">{i + 1}</span>
              <span className="absolute inset-x-1 bottom-1 flex justify-between">
                <span className="flex gap-1">
                  <button type="button" aria-label="Avancer la photo" disabled={i === 0} onClick={() => movePhoto(i, i - 1)} className="grid size-8 place-items-center rounded-full bg-white/90 disabled:opacity-40"><ArrowUp className="size-4 -rotate-90" /></button>
                  <button type="button" aria-label="Reculer la photo" disabled={i === v.photos.length - 1} onClick={() => movePhoto(i, i + 1)} className="grid size-8 place-items-center rounded-full bg-white/90 disabled:opacity-40"><ArrowDown className="size-4 -rotate-90" /></button>
                </span>
                <button type="button" aria-label="Retirer la photo" onClick={() => set("photos", v.photos.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full bg-white/90 text-red-600"><X className="size-4" /></button>
              </span>
            </li>
          ))}
          {v.photos.length < maxPhotos && (
            <li>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading > 0} className={cn("flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white text-sm font-bold text-ink-soft hover:border-coral", uploading > 0 && "animate-pulse")}>
                <ImagePlus className="size-7" /> {uploading > 0 ? `Envoi (${uploading})…` : "Ajouter des photos"}
              </button>
            </li>
          )}
        </ul>
        <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
      </section>

      <section className="card-soft space-y-4 p-5 sm:p-6">
        <h2 className="font-heading text-xl font-bold">Votre apport</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["IDEA", "Mon idée et quelques photos", `Le studio fait tout le reste · ${rates.idea} des ventes`], ["FULL_TUTORIAL", "Un tutoriel complet", `Avec mes photos de chaque étape · ${rates.full} des ventes`]] as const).map(([val, label, hint]) => (
            <label key={val} className={cn("cursor-pointer rounded-2xl border-2 bg-white p-4", v.contribution === val ? "border-coral" : "border-line")}>
              <input type="radio" name="contribution" value={val} checked={v.contribution === val} onChange={() => set("contribution", val)} className="sr-only" />
              <span className="block font-bold">{label}</span>
              <span className="mt-1 block text-sm text-ink-soft">{hint}</span>
            </label>
          ))}
        </div>
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 text-sm">
          <input type="checkbox" checked={v.exclusive} onChange={(e) => set("exclusive", e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-coral" />
          <span><strong>J&apos;accorde l&apos;exclusivité à La Malle à Jeux</strong> pour ce tutoriel (+{rates.bonus}). Facultatif.</span>
        </label>
      </section>

      {problem && <Alert variant="danger">{problem}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" disabled={pending || uploading > 0}><Send className="size-5" /> {pending ? "Envoi…" : "Envoyer pour validation"}</Button>
        <Button type="button" variant="outline" size="lg" disabled={pending || uploading > 0} onClick={() => submit(false)}><Save className="size-5" /> Enregistrer le brouillon</Button>
      </div>
    </form>
  );
}
