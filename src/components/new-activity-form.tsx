"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createActivityConcept, generateActivity } from "@/app/actions/activities";
import { AGE_RANGES, ageRangeLabel, BOOK_TYPES } from "@/lib/schemas/activity";

export function NewActivityForm({ books, defaultBookId }: { books: { id: string; title: string; ageRange: string }[]; defaultBookId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", summary: "", category: "sciences", finalObject: "", mainConcept: "", difficulty: 2, durationMinutes: 30, keyMaterials: "", ageRange: "6-9", bookId: defaultBookId ?? "", generate: true });
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          try {
            const id = await createActivityConcept({
              concept: { title: f.title, summary: f.summary, category: f.category, finalObject: f.finalObject, mainConcept: f.mainConcept, difficulty: Number(f.difficulty), durationMinutes: Number(f.durationMinutes), keyMaterials: f.keyMaterials.split(",").map((s) => s.trim()).filter(Boolean) },
              ageRange: f.ageRange,
              bookId: f.bookId || undefined,
            });
            if (f.generate) await generateActivity(id);
            router.push(`/activities/${id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        });
      }}
    >
      <Field label="Titre"><Input required minLength={3} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Construis ta voiture propulsée par un ballon" /></Field>
      <Field label="Résumé (1-2 phrases)"><Textarea required minLength={20} rows={2} value={f.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Objet ou résultat final"><Input required value={f.finalObject} onChange={(e) => set("finalObject", e.target.value)} /></Field>
        <Field label="Notion principale"><Input required value={f.mainConcept} onChange={(e) => set("mainConcept", e.target.value)} /></Field>
        <Field label="Catégorie">
          <Select value={f.category} onChange={(e) => set("category", e.target.value)}>{BOOK_TYPES.map((t) => <option key={t.category} value={t.category}>{t.label}</option>)}</Select>
        </Field>
        <Field label="Âge"><Select value={f.ageRange} onChange={(e) => set("ageRange", e.target.value)}>{AGE_RANGES.map((a) => <option key={a} value={a}>{ageRangeLabel(a)}</option>)}</Select></Field>
        <Field label="Difficulté (1-5)"><Input type="number" min={1} max={5} value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)} /></Field>
        <Field label="Durée (min)"><Input type="number" min={5} max={240} value={f.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} /></Field>
      </div>
      <Field label="Matériel clé (séparé par des virgules)"><Input required value={f.keyMaterials} onChange={(e) => set("keyMaterials", e.target.value)} placeholder="carton, bouchons, ballon, pailles" /></Field>
      <Field label="Rattacher à un livre (facultatif)">
        <Select value={f.bookId} onChange={(e) => set("bookId", e.target.value)}>
          <option value="">— Bibliothèque uniquement —</option>
          {books.map((b) => <option key={b.id} value={b.id}>{b.title} ({ageRangeLabel(b.ageRange)})</option>)}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.generate} onChange={(e) => set("generate", e.target.checked)} /> Rédiger immédiatement la fiche complète avec l'IA</label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={pending}>Créer l'activité</Button>
    </form>
  );
}
