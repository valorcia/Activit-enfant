"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { regenerateIllustration, reviewIllustrationAction } from "@/app/actions/activities";
import type { ActivityContent } from "@/lib/schemas/activity";
import type { IllustrationKind } from "@prisma/client";

export interface IllustrationView { id: string; kind: string; stepIndex: number | null; version: number; status: string; isDemo: boolean; isCurrent: boolean; src?: string; prompt: string | null; reviewNote: string | null; error: string | null; width: number | null; provider: string | null }

export function IllustrationPanel({ activityId, content, illustrations, onJob, imageProvider }: { activityId: string; content: ActivityContent | null; illustrations: IllustrationView[]; onJob: (id: string) => void; imageProvider: string }) {
  if (!content) return <p className="text-sm text-slate-500">Rédigez d'abord la fiche.</p>;
  const slots: { kind: IllustrationKind; stepIndex?: number; label: string; brief: string }[] = [
    { kind: "FINAL", label: "Résultat final", brief: content.finalIllustrationBrief },
    ...content.steps.map((s, i) => ({ kind: "STEP" as IllustrationKind, stepIndex: i, label: `Étape ${i + 1} — ${s.title}`, brief: s.illustrationBrief })),
  ];
  return (
    <div className="space-y-4">
      {imageProvider === "mock" && <p className="text-xs rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-900">Fournisseur d'images de démonstration : les images générées sont des placeholders étiquetés « DÉMO » et ne doivent pas être acceptées comme définitives.</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {slots.map((slot) => (
          <Slot key={`${slot.kind}-${slot.stepIndex ?? ""}`} activityId={activityId} slot={slot} versions={illustrations.filter((i) => i.kind === slot.kind && (i.stepIndex ?? null) === (slot.stepIndex ?? null))} onJob={onJob} />
        ))}
      </div>
    </div>
  );
}

function Slot({ activityId, slot, versions, onJob }: { activityId: string; slot: { kind: IllustrationKind; stepIndex?: number; label: string; brief: string }; versions: IllustrationView[]; onJob: (id: string) => void }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);
  const current = versions.find((v) => v.isCurrent) ?? versions[0];
  const list = showAll ? versions : current ? [current] : [];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2"><div className="font-semibold text-sm truncate">{slot.label}</div>{current && <StatusBadge kind="illustration" status={current.status} />}</div>
      {list.map((v) => (
        <div key={v.id} className={`rounded-lg overflow-hidden border ${v.isCurrent ? "border-blue-300" : "border-slate-100 opacity-80"}`}>
          {v.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.src} alt={slot.label} className="w-full aspect-square object-cover" />
          ) : (
            <div className="w-full aspect-square bg-slate-100 flex items-center justify-center text-xs text-slate-500 p-3 text-center">{v.error ?? v.status}</div>
          )}
          <div className="p-2 text-xs text-slate-500 flex items-center justify-between">
            <span>v{v.version} · {v.provider ?? "—"} {v.width ? `· ${v.width}px` : ""} {v.isDemo ? "· DÉMO" : ""}</span>
            {!v.isCurrent && <span>archivée</span>}
          </div>
          {v.reviewNote && <div className="px-2 pb-2 text-xs text-slate-600">Note : {v.reviewNote}</div>}
        </div>
      ))}
      {!current && <div className="aspect-square rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-500 p-3 text-center">{slot.brief}</div>}
      <Input placeholder="Note de validation (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-xs" />
      <div className="flex flex-wrap gap-1">
        {current && current.status !== "ACCEPTED" && current.src && !current.isDemo && <Button size="sm" variant="success" disabled={pending} onClick={() => start(() => reviewIllustrationAction(current.id, "ACCEPTED", note))}>Accepter</Button>}
        {current && current.src && current.status !== "REJECTED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => reviewIllustrationAction(current.id, "REJECTED", note))}>Refuser</Button>}
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await regenerateIllustration(activityId, slot.kind, slot.stepIndex); onJob(r.jobId); })}>{current ? "Régénérer" : "Générer"}</Button>
        {versions.length > 1 && <Button size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)}>{showAll ? "Masquer" : `${versions.length} versions`}</Button>}
      </div>
    </div>
  );
}
