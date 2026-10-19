"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { saveVisualReferenceAction } from "@/app/actions/activities";
import type { VisualReferenceSheet } from "@/lib/schemas/activity";

const EMPTY: VisualReferenceSheet = { finalObject: "", shape: "", colors: [], materials: [], dimensions: "", mainParts: [], characters: "", setting: "", stepAppearances: [], styleNotes: "", negativePrompt: "" };

export function VisualReferenceForm({ activityId, initial, stepCount }: { activityId: string; initial: VisualReferenceSheet | null; stepCount: number }) {
  const [r, setR] = useState<VisualReferenceSheet>(initial ?? { ...EMPTY, stepAppearances: Array.from({ length: stepCount }, (_, i) => ({ stepIndex: i, appearance: "" })) });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof VisualReferenceSheet>(k: K, v: VisualReferenceSheet[K]) => setR((p) => ({ ...p, [k]: v }));
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <form className="rounded-xl border border-slate-200 bg-white p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { try { await saveVisualReferenceAction(activityId, r); setMsg("Fiche de référence enregistrée."); } catch (err) { setMsg(`Erreur : ${err instanceof Error ? err.message : err}`); } }); }}>
      <p className="text-sm text-slate-600">Cette fiche guide toutes les générations d'images de l'activité : même objet, mêmes couleurs, mêmes personnages d'une étape à l'autre. {!initial && "Elle est générée automatiquement lors de la rédaction ; vous pouvez la compléter ici."}</p>
      <Field label="Objet final"><Textarea rows={2} value={r.finalObject} onChange={(e) => set("finalObject", e.target.value)} /></Field>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Forme et proportions"><Textarea rows={2} value={r.shape} onChange={(e) => set("shape", e.target.value)} /></Field>
        <Field label="Dimensions approximatives"><Input value={r.dimensions} onChange={(e) => set("dimensions", e.target.value)} /></Field>
        <Field label="Couleurs (une par ligne)"><Textarea rows={4} value={r.colors.join("\n")} onChange={(e) => set("colors", lines(e.target.value))} /></Field>
        <Field label="Matériaux (un par ligne)"><Textarea rows={4} value={r.materials.join("\n")} onChange={(e) => set("materials", lines(e.target.value))} /></Field>
        <Field label="Personnages récurrents"><Textarea rows={2} value={r.characters} onChange={(e) => set("characters", e.target.value)} /></Field>
        <Field label="Décor constant"><Textarea rows={2} value={r.setting} onChange={(e) => set("setting", e.target.value)} /></Field>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1"><span className="text-sm font-semibold">Pièces principales</span><Button type="button" size="sm" variant="secondary" onClick={() => set("mainParts", [...r.mainParts, { name: "", appearance: "" }])}>Ajouter</Button></div>
        {r.mainParts.map((p, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 mb-2">
            <Input className="col-span-3" placeholder="Pièce" value={p.name} onChange={(e) => set("mainParts", r.mainParts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input className="col-span-8" placeholder="Apparence" value={p.appearance} onChange={(e) => set("mainParts", r.mainParts.map((x, j) => (j === i ? { ...x, appearance: e.target.value } : x)))} />
            <Button type="button" size="sm" variant="ghost" onClick={() => set("mainParts", r.mainParts.filter((_, j) => j !== i))}>✕</Button>
          </div>
        ))}
      </div>
      <div>
        <span className="text-sm font-semibold">Apparence à chaque étape</span>
        {Array.from({ length: Math.max(stepCount, r.stepAppearances.length) }, (_, i) => {
          const cur = r.stepAppearances.find((s) => s.stepIndex === i)?.appearance ?? "";
          return (
            <div key={i} className="flex gap-2 items-center mt-1">
              <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
              <Input value={cur} onChange={(e) => { const others = r.stepAppearances.filter((s) => s.stepIndex !== i); set("stepAppearances", [...others, { stepIndex: i, appearance: e.target.value }].sort((a, b) => a.stepIndex - b.stepIndex)); }} />
            </div>
          );
        })}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Notes de style (cadrage, fond)"><Textarea rows={2} value={r.styleNotes} onChange={(e) => set("styleNotes", e.target.value)} /></Field>
        <Field label="À éviter (prompt négatif)"><Textarea rows={2} value={r.negativePrompt} onChange={(e) => set("negativePrompt", e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-3"><Button type="submit" disabled={pending}>Enregistrer</Button>{msg && <span className="text-sm">{msg}</span>}</div>
    </form>
  );
}
