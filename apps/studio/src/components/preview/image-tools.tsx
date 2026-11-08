"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crop, RefreshCw, Upload } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { JobProgress } from "@/components/job-progress";
import { FramingEditor, type FramingTarget } from "./framing-editor";
import { estimateReworkAction, replaceIllustrationUploadAction, reworkIllustrationAction } from "@/app/actions/images";
import { formatUsd } from "@/lib/utils";

export type ImageToolTab = "recadrer" | "remplacer" | "regenerer";

/**
 * Outils d'une image : recadrer (gratuit, proposé en premier), remplacer par un fichier
 * (gratuit), regénérer (coût estimé, confirmation explicite, correction libre possible).
 */
export function ImageToolsDialog({ ill, frame, open, onOpenChange, initialTab = "recadrer", isSketch }: { ill: FramingTarget; frame?: { w: number; h: number }; open: boolean; onOpenChange: (o: boolean) => void; initialTab?: ImageToolTab; isSketch?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<ImageToolTab>(initialTab);
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Image : ${ill.label}`} className="max-w-4xl">
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
          {([
            ["recadrer", "Recadrer (gratuit)", Crop],
            ["remplacer", "Remplacer par un fichier", Upload],
            ["regenerer", "Regénérer (payant)", RefreshCw],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold ${tab === k ? "bg-white shadow-sm" : "text-slate-600"}`} onClick={() => setTab(k)}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        {tab === "recadrer" && <FramingEditor key={ill.id} ill={ill} frame={frame} onSaved={() => router.refresh()} />}
        {tab === "remplacer" && <UploadReplace ill={ill} onDone={() => { router.refresh(); onOpenChange(false); }} />}
        {tab === "regenerer" && <Regenerate ill={ill} isSketch={isSketch} onFraming={() => setTab("recadrer")} onDone={() => router.refresh()} />}
      </DialogContent>
    </Dialog>
  );
}

function UploadReplace({ ill, onDone }: { ill: FramingTarget; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      action={(fd) => start(async () => {
        setError(null);
        fd.set("illustrationId", ill.id);
        const r = await replaceIllustrationUploadAction(fd);
        if (r.ok) onDone();
        else setError(r.error);
      })}
    >
      <p className="text-sm text-slate-600">Téléversez votre propre image (PNG, JPG ou WebP). Pour un rendu net à l'impression, visez au moins {ill.targetRatio === "landscape" ? "1536 × 1024" : ill.targetRatio === "portrait" ? "1024 × 1536" : "1024 × 1024"} px, au format {ill.targetRatio === "landscape" ? "paysage" : ill.targetRatio === "portrait" ? "portrait" : "carré"}. Aucun coût.</p>
      <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="block text-sm" />
      <Button type="submit" disabled={pending}><Upload className="h-4 w-4" /> Remplacer l'image</Button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}

function Regenerate({ ill, isSketch, onFraming, onDone }: { ill: FramingTarget; isSketch?: boolean; onFraming: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"correction" | "fresh" | "final">(isSketch ? "final" : "correction");
  const [correction, setCorrection] = useState("");
  const [estimate, setEstimate] = useState<{ costUsd: number; quality: string; manual: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    setConfirming(false);
    estimateReworkAction(ill.id, mode).then((r) => setEstimate(r.ok ? r.data : null));
  }, [ill.id, mode]);
  const cost = estimate ? (estimate.manual ? "0 $ (copier-coller dans ChatGPT)" : formatUsd(estimate.costUsd)) : "…";
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Avant de payer une nouvelle génération : un simple <button className="font-semibold underline" onClick={onFraming}>recadrage</button> (gratuit) suffit souvent à corriger une image coupée ou mal centrée.
      </div>
      <div className="space-y-1.5 text-sm">
        {isSketch && (
          <label className="flex items-start gap-2"><input type="radio" checked={mode === "final"} onChange={() => setMode("final")} className="mt-1" /> <span><b>Version finale</b> de cette esquisse : même prompt, l'esquisse sert de référence pour garder la composition.</span></label>
        )}
        <label className="flex items-start gap-2"><input type="radio" checked={mode === "correction"} onChange={() => setMode("correction")} className="mt-1" /> <span><b>Regénérer avec correction</b> : l'image actuelle sert de référence, votre correction est ajoutée au prompt.</span></label>
        <label className="flex items-start gap-2"><input type="radio" checked={mode === "fresh"} onChange={() => setMode("fresh")} className="mt-1" /> <span><b>Nouvelle image</b> avec le même prompt (composition différente).</span></label>
      </div>
      {mode === "correction" && <Textarea rows={3} value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Ex. : le personnage regarde vers la droite, le coffre est plus grand, pas de nuages" aria-label="Correction" />}
      <div className="text-sm">Coût estimé : <b>{cost}</b>{estimate ? ` · qualité ${estimate.quality === "low" ? "esquisse" : estimate.quality === "medium" ? "moyenne" : "haute"}` : ""}</div>
      {!jobId && (confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={pending || (mode === "correction" && !correction.trim())}
            onClick={() => start(async () => {
              setError(null);
              const r = await reworkIllustrationAction(ill.id, mode, correction);
              if (r.ok) setJobId(r.data.jobId);
              else setError(r.error);
            })}
          >Confirmer la génération ({cost})</Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>Annuler</Button>
        </div>
      ) : (
        <Button variant="secondary" disabled={mode === "correction" && !correction.trim()} onClick={() => setConfirming(true)}><RefreshCw className="h-4 w-4" /> {mode === "final" ? "Générer la version finale" : "Regénérer cette image"}</Button>
      ))}
      {jobId && <JobProgress jobId={jobId} compact title="Reprise de l'image" onDone={() => { setJobId(null); onDone(); }} />}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
