"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { saveActivityContent } from "@/app/actions/activities";
import { AGE_RANGES, ageRangeLabel, type ActivityContent } from "@/lib/schemas/activity";

export function ActivityForm({ activityId, initial }: { activityId: string; initial: ActivityContent }) {
  const [c, setC] = useState<ActivityContent>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof ActivityContent>(k: K, v: ActivityContent[K]) => setC((p) => ({ ...p, [k]: v }));
  const setStep = (i: number, patch: Partial<ActivityContent["steps"][number]>) => set("steps", c.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setMat = (i: number, patch: Partial<ActivityContent["materials"][number]>) => set("materials", c.materials.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            await saveActivityContent(activityId, c);
            setMsg("Nouvelle version enregistrée.");
          } catch (err) {
            setMsg(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
          }
        });
      }}
    >
      <section className="rounded-xl border border-slate-200 bg-white p-5 grid md:grid-cols-2 gap-4">
        <Field label="Titre" className="md:col-span-2"><Input value={c.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Sous-titre" className="md:col-span-2"><Input value={c.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} /></Field>
        <Field label="Description" className="md:col-span-2"><Textarea rows={3} value={c.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Objectif pédagogique" className="md:col-span-2"><Textarea rows={2} value={c.pedagogicalGoal} onChange={(e) => set("pedagogicalGoal", e.target.value)} /></Field>
        <Field label="Âge"><Select value={c.ageRange} onChange={(e) => set("ageRange", e.target.value as ActivityContent["ageRange"])}>{AGE_RANGES.map((a) => <option key={a} value={a}>{ageRangeLabel(a)}</option>)}</Select></Field>
        <Field label="Catégorie"><Input value={c.category} onChange={(e) => set("category", e.target.value)} /></Field>
        <Field label="Durée (min)"><Input type="number" value={c.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></Field>
        <Field label="Difficulté (1-5)"><Input type="number" min={1} max={5} value={c.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))} /></Field>
        <Field label="Mots-clés (virgules)" className="md:col-span-2"><Input value={c.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></Field>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-bold">Matériel ({c.materials.length})</h3><Button type="button" size="sm" variant="secondary" onClick={() => set("materials", [...c.materials, { name: "", quantity: "", optional: false, note: "" }])}>Ajouter</Button></div>
        {c.materials.map((m, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <Input className="col-span-5" placeholder="Nom" value={m.name} onChange={(e) => setMat(i, { name: e.target.value })} />
            <Input className="col-span-2" placeholder="Quantité" value={m.quantity ?? ""} onChange={(e) => setMat(i, { quantity: e.target.value })} />
            <Input className="col-span-3" placeholder="Note" value={m.note ?? ""} onChange={(e) => setMat(i, { note: e.target.value })} />
            <label className="col-span-1 text-xs flex items-center gap-1"><input type="checkbox" checked={m.optional ?? false} onChange={(e) => setMat(i, { optional: e.target.checked })} />opt.</label>
            <Button type="button" size="sm" variant="ghost" className="col-span-1" onClick={() => set("materials", c.materials.filter((_, j) => j !== i))}>✕</Button>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between"><h3 className="font-bold">Étapes ({c.steps.length})</h3><Button type="button" size="sm" variant="secondary" onClick={() => set("steps", [...c.steps, { title: "", instruction: "", tip: "", adultHelp: false, illustrationBrief: "" }])}>Ajouter une étape</Button></div>
        {c.steps.map((s, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-400">{i + 1}</span>
              <Input placeholder="Titre de l'étape" value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} />
              <label className="text-xs flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={s.adultHelp ?? false} onChange={(e) => setStep(i, { adultHelp: e.target.checked })} />aide adulte</label>
              <Button type="button" size="sm" variant="ghost" onClick={() => set("steps", c.steps.filter((_, j) => j !== i))}>✕</Button>
            </div>
            <Textarea rows={3} placeholder="Instruction" value={s.instruction} onChange={(e) => setStep(i, { instruction: e.target.value })} />
            <Input placeholder="Astuce" value={s.tip ?? ""} onChange={(e) => setStep(i, { tip: e.target.value })} />
            <Textarea rows={2} placeholder="Brief de l'illustration de l'étape" value={s.illustrationBrief} onChange={(e) => setStep(i, { illustrationBrief: e.target.value })} />
          </div>
        ))}
        <Field label="Brief de l'illustration finale"><Textarea rows={3} value={c.finalIllustrationBrief} onChange={(e) => set("finalIllustrationBrief", e.target.value)} /></Field>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="font-bold">Explication scientifique / pédagogique</h3>
          <Input value={c.explanation.title} onChange={(e) => set("explanation", { ...c.explanation, title: e.target.value })} />
          <Textarea rows={7} value={c.explanation.body} onChange={(e) => set("explanation", { ...c.explanation, body: e.target.value })} />
          <Input placeholder="Mots-clés (virgules)" value={c.explanation.keyWords.join(", ")} onChange={(e) => set("explanation", { ...c.explanation, keyWords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </div>
        <div className="space-y-3">
          <h3 className="font-bold">Défi complémentaire</h3>
          <Input value={c.challenge.title} onChange={(e) => set("challenge", { ...c.challenge, title: e.target.value })} />
          <Textarea rows={4} value={c.challenge.body} onChange={(e) => set("challenge", { ...c.challenge, body: e.target.value })} />
          <Field label="Le sais-tu ? (anecdote)"><Textarea rows={2} value={c.funFact ?? ""} onChange={(e) => set("funFact", e.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="font-bold">Sécurité</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Supervision adulte">
            <Select value={c.safety.adultSupervision} onChange={(e) => set("safety", { ...c.safety, adultSupervision: e.target.value as ActivityContent["safety"]["adultSupervision"] })}>
              <option value="none">Autonomie possible</option><option value="recommended">Adulte recommandé</option><option value="required">Adulte obligatoire</option>
            </Select>
          </Field>
          <Field label="Risques (virgules : tools, small_parts, substances, heat, electricity, sharp, water, allergens, other)">
            <Input value={c.safety.hazards.join(", ")} onChange={(e) => set("safety", { ...c.safety, hazards: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) as ActivityContent["safety"]["hazards"] })} />
          </Field>
        </div>
        <Field label="Consignes de sécurité (une par ligne)"><Textarea rows={4} value={c.safety.warnings.join("\n")} onChange={(e) => set("safety", { ...c.safety, warnings: e.target.value.split("\n").filter(Boolean) })} /></Field>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>Enregistrer (nouvelle version)</Button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}
