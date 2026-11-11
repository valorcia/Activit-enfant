"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { previewAutopilotAction, startAutopilotAction, type AutopilotPreview } from "@/app/actions/autopilot";
import { STAGE_LABELS } from "@/lib/autopilot/stages";

const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

/** Bouton « Tout lancer en automatique » : récapitulatif des réglages et estimation de coût, puis lancement. */
export function AutopilotLaunch({ text, disabled, siteSlug }: { text: string; disabled?: boolean; siteSlug?: string | null }) {
  const router = useRouter();
  const [preview, setPreview] = useState<AutopilotPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setPreview(null), [siteSlug]);

  const open = () =>
    start(async () => {
      setError(null);
      const r = await previewAutopilotAction(text, siteSlug);
      if (r.ok) setPreview(r.data);
      else setError(r.error);
    });

  const launch = (imagesViaApi = false) =>
    start(async () => {
      setError(null);
      const r = await startAutopilotAction(text, siteSlug, { imagesViaApi });
      if (r.ok) router.push(`/autopilot/${r.data.runId}`);
      else setError(r.error);
    });

  return (
    <div className="space-y-3">
      <Button size="lg" onClick={open} disabled={disabled || pending || text.trim().length < 10} className="bg-emerald-600 hover:bg-emerald-700">
        <Rocket className="h-4 w-4" /> {pending && !preview ? "Préparation…" : "Tout lancer en automatique"}
      </Button>
      {preview && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-black text-emerald-950">Pilote automatique</h3>
            <span className="text-sm text-emerald-900">{preview.title ? `« ${preview.title} » · ` : ""}{preview.siteName ? `${preview.siteName} · ` : ""}{preview.kitLabel} · {preview.count} {preview.countLabel}</span>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-950">
            {preview.summary.map((s) => <li key={s}>{s}</li>)}
          </ul>
          <div className="rounded-lg bg-white p-3 text-sm">
            <div className="mb-2 flex items-baseline justify-between"><span className="font-bold">Coût estimé</span><span className="text-lg font-black">{usd(preview.estimate.totalUsd)}</span></div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
              {Object.entries(preview.estimate.stages).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => <span key={k} className="flex justify-between"><span>{STAGE_LABELS[k as keyof typeof STAGE_LABELS]}</span><span>{usd(v ?? 0)}</span></span>)}
            </div>
            {Object.values(preview.estimate.lines).some(Boolean) && <ul className="mt-2 space-y-0.5 text-xs text-slate-500">{Object.entries(preview.estimate.lines).map(([k, l]) => l && <li key={k}><b>{STAGE_LABELS[k as keyof typeof STAGE_LABELS]}</b> : {l}</li>)}</ul>}
            {preview.coloringApi && <p className="mt-2 rounded-md bg-violet-50 px-2 py-1.5 text-xs text-violet-900">Images du cahier par l&apos;API : <b>{preview.coloringApi.label}</b></p>}
            {preview.estimate.notes.length > 0 && <p className="mt-2 text-xs text-slate-500">{preview.estimate.notes.join(" ")}</p>}
            <p className="mt-2 text-xs text-slate-500">Plafond par e-book : {usd(preview.maxCostUsd)} (le run s&apos;arrête pour validation s&apos;il risque de le dépasser).</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => launch()} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700"><Rocket className="h-4 w-4" /> {pending ? "Lancement…" : "Confirmer et lancer"}</Button>
            {preview.coloringApi?.manualImagesNow && (
              <Button size="lg" onClick={() => launch(true)} disabled={pending} className="bg-violet-600 hover:bg-violet-700">Générer les images par l&apos;API (≈ {usd(preview.coloringApi.totalUsd)}, aucune intervention)</Button>
            )}
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={pending}>Annuler</Button>
            <Link href="/settings#autopilot" className="text-sm text-emerald-900 underline">Modifier les réglages du pilote</Link>
          </div>
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}
