"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Trash2, RefreshCw, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { JobProgress } from "@/components/job-progress";
import { addConceptToBook, regenerateOutline, removeActivityFromBook, reorderBookActivities, updateConcept, validateOutline, updateBookMeta } from "@/app/actions/books";
import { difficultyLabel } from "@/lib/schemas/activity";
import type { ActivityRow, BookView } from "./book-tabs";

export function OutlineTab({ book, activities }: { book: BookView; activities: ActivityRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [intro, setIntro] = useState(book.introduction);
  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle ?? "");
  const conceptCount = activities.filter((a) => a.status === "CONCEPT").length;

  const move = (idx: number, dir: -1 | 1) => {
    const ids = activities.map((a) => a.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    start(() => reorderBookActivities(book.id, ids));
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Ajouter une activité</Button>
          <Button size="sm" variant="secondary" disabled={pending || Boolean(jobId)} onClick={() => start(async () => { const r = await regenerateOutline(book.id); setJobId(r.jobId); })}>
            <RefreshCw className="h-4 w-4" /> Régénérer les concepts non rédigés
          </Button>
          {book.status === "DRAFT" && <Button size="sm" variant="success" disabled={pending} onClick={() => start(() => validateOutline(book.id))}><Check className="h-4 w-4" /> Valider le sommaire</Button>}
          <span className="text-xs text-slate-500">{conceptCount} concept(s) à rédiger · {activities.length - conceptCount} fiche(s) rédigée(s)</span>
        </div>
        {jobId && <JobProgress jobId={jobId} title="Génération du sommaire" onDone={() => { setJobId(null); router.refresh(); }} />}
        {activities.length === 0 && <p className="text-sm text-slate-500 rounded-lg border border-dashed p-6 text-center">Aucune activité. Le sommaire est en cours de génération ou n'a pas encore été lancé.</p>}
        <ol className="space-y-2">
          {activities.map((a, idx) => {
            const c = (a.concept ?? {}) as { summary?: string; finalObject?: string; mainConcept?: string; keyMaterials?: string[] };
            const accepted = a.illustrations.filter((i) => i.status === "ACCEPTED").length;
            return (
              <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 flex gap-3">
                <div className="flex flex-col gap-1">
                  <button className="p-1 rounded hover:bg-slate-100 cursor-pointer" onClick={() => move(idx, -1)} disabled={idx === 0 || pending} aria-label="Monter"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button className="p-1 rounded hover:bg-slate-100 cursor-pointer" onClick={() => move(idx, 1)} disabled={idx === activities.length - 1 || pending} aria-label="Descendre"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                <div className="w-8 text-center font-black text-slate-400 pt-1">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/activities/${a.id}`} className="font-bold hover:underline">{a.title}</Link>
                    <StatusBadge kind="activity" status={a.status} />
                    <span className="text-xs text-slate-500">{difficultyLabel(a.difficulty)} · {a.durationMinutes} min</span>
                    {a.issues.blockers > 0 && <span className="text-xs text-red-700 font-semibold">{a.issues.blockers} blocage(s) sécurité</span>}
                    {a.issues.errors > 0 && <span className="text-xs text-red-600">{a.issues.errors} erreur(s)</span>}
                    {a.illustrations.length > 0 && <span className="text-xs text-slate-500">{accepted}/{a.illustrations.length} illustrations acceptées</span>}
                  </div>
                  {c.summary && <p className="text-sm text-slate-600 mt-1">{c.summary}</p>}
                  {c.finalObject && <p className="text-xs text-slate-500 mt-0.5">Objet : {c.finalObject} · Notion : {c.mainConcept}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label="Modifier"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm(a.hasContent ? "Retirer cette activité du livre ? (elle reste dans la bibliothèque)" : "Supprimer ce concept ?")) start(() => removeActivityFromBook(book.id, a.id, !a.hasContent)); }} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h3 className="font-bold">Informations du livre</h3>
          <Field label="Titre"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Sous-titre"><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></Field>
          <Field label="Introduction (page de bienvenue)"><Textarea rows={6} value={intro} onChange={(e) => setIntro(e.target.value)} /></Field>
          <Button size="sm" disabled={pending} onClick={() => start(() => updateBookMeta(book.id, { title, subtitle, introduction: intro }))}>Enregistrer</Button>
        </div>
      </div>

      {editing && (
        <ConceptDialog
          title="Modifier le concept"
          initial={{ title: editing.title, ...((editing.concept ?? {}) as object) }}
          onClose={() => setEditing(null)}
          onSave={(c) => start(async () => { await updateConcept(editing.id, c); setEditing(null); })}
        />
      )}
      {adding && (
        <ConceptDialog
          title="Ajouter une activité au sommaire"
          initial={{ title: "", summary: "", category: activities[0]?.category ?? "sciences", finalObject: "", mainConcept: "", difficulty: 2, durationMinutes: 30, keyMaterials: [] }}
          onClose={() => setAdding(false)}
          onSave={(c) => start(async () => { await addConceptToBook(book.id, c as never); setAdding(false); })}
        />
      )}
    </div>
  );
}

type ConceptForm = { title: string; summary?: string; category?: string; finalObject?: string; mainConcept?: string; difficulty?: number; durationMinutes?: number; keyMaterials?: string[] };

function ConceptDialog({ title, initial, onClose, onSave }: { title: string; initial: ConceptForm; onClose: () => void; onSave: (c: ConceptForm) => void }) {
  const [f, setF] = useState<ConceptForm>({ summary: "", category: "sciences", finalObject: "", mainConcept: "", difficulty: 2, durationMinutes: 30, keyMaterials: [], ...initial });
  const set = (k: keyof ConceptForm, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={title}>
        <div className="space-y-3">
          <Field label="Titre"><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Résumé"><Textarea rows={2} value={f.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Objet final"><Input value={f.finalObject} onChange={(e) => set("finalObject", e.target.value)} /></Field>
            <Field label="Notion principale"><Input value={f.mainConcept} onChange={(e) => set("mainConcept", e.target.value)} /></Field>
            <Field label="Catégorie"><Input value={f.category} onChange={(e) => set("category", e.target.value)} /></Field>
            <Field label="Matériel clé (virgules)"><Input value={(f.keyMaterials ?? []).join(", ")} onChange={(e) => set("keyMaterials", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></Field>
            <Field label="Difficulté (1-5)"><Input type="number" min={1} max={5} value={f.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))} /></Field>
            <Field label="Durée (min)"><Input type="number" min={5} value={f.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></Field>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => onSave(f)}>Enregistrer</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
