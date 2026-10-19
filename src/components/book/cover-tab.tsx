"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { JobProgress } from "@/components/job-progress";
import { generateCover, regenerateCoverIllustration, saveCover } from "@/app/actions/books";
import { reviewIllustrationAction } from "@/app/actions/activities";
import type { CoverData } from "@/lib/schemas/activity";
import type { BookView, CoverIll } from "./book-tabs";

export function CoverTab({ book, cover, illustrations }: { book: BookView; cover: CoverData & { introduction?: string }; illustrations: CoverIll[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState<string | null>(null);
  const [c, setC] = useState<CoverData>(cover);
  const set = <K extends keyof CoverData>(k: K, v: CoverData[K]) => setC((p) => ({ ...p, [k]: v }));
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-bold">Textes de couverture</h3><Button size="sm" variant="secondary" disabled={pending || Boolean(jobId)} onClick={() => start(async () => { const r = await generateCover(book.id, 2); setJobId(r.jobId); })}>Générer (textes + 2 illustrations)</Button></div>
        <Field label="Titre"><Input value={c.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Sous-titre"><Input value={c.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Collection (logo texte)"><Input value={c.collection} onChange={(e) => set("collection", e.target.value)} /></Field>
          <Field label="Tranche d'âge"><Input value={c.ageLabel} onChange={(e) => set("ageLabel", e.target.value)} /></Field>
        </div>
        <Field label="Accroche"><Input value={c.tagline} onChange={(e) => set("tagline", e.target.value)} /></Field>
        <Field label="Quatrième de couverture"><Textarea rows={5} value={c.backText} onChange={(e) => set("backText", e.target.value)} /></Field>
        <Field label="Points forts (un par ligne)"><Textarea rows={4} value={c.backBullets.join("\n")} onChange={(e) => set("backBullets", e.target.value.split("\n").filter(Boolean))} /></Field>
        <Field label="Brief de l'illustration principale"><Textarea rows={3} value={c.illustrationBrief} onChange={(e) => set("illustrationBrief", e.target.value)} /></Field>
        <Button disabled={pending} onClick={() => start(() => saveCover(book.id, c))}>Enregistrer les textes</Button>
        {jobId && <JobProgress jobId={jobId} title="Couverture" onDone={() => { setJobId(null); router.refresh(); }} />}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold">Propositions d'illustration</h3><Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await regenerateCoverIllustration(book.id, illustrations.length % 4); setJobId(r.jobId); })}>Nouvelle proposition</Button></div>
        {illustrations.length === 0 && <p className="text-sm text-slate-500">Aucune proposition pour l'instant.</p>}
        <div className="grid grid-cols-2 gap-3">
          {illustrations.map((ill) => (
            <div key={ill.id} className={`rounded-lg border p-2 ${ill.isCurrent ? "border-blue-500" : "border-slate-200"}`}>
              {ill.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ill.src} alt="" className="w-full aspect-square object-cover rounded" />
              ) : (
                <div className="w-full aspect-square bg-slate-100 rounded flex items-center justify-center text-xs text-slate-500">{ill.status}</div>
              )}
              <div className="flex items-center justify-between mt-2 text-xs">
                <span>v{ill.version} {ill.isCurrent ? "· utilisée" : ""} {ill.isDemo ? "· DÉMO" : ""}</span>
                <StatusBadge kind="illustration" status={ill.status} />
              </div>
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="success" disabled={pending} onClick={() => start(() => reviewIllustrationAction(ill.id, "ACCEPTED"))}>Accepter</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => reviewIllustrationAction(ill.id, "REJECTED"))}>Refuser</Button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">La proposition la plus récente est utilisée sur la couverture ; après acceptation ou refus, relancez l'assemblage des pages.</p>
      </div>
    </div>
  );
}
