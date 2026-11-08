"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Circle, CircleDashed, ClipboardPaste, ExternalLink, Loader2, Pause, Play, RotateCcw, SkipForward, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveAutopilotAction, cancelAutopilotAction, resumeAutopilotAction, retryAutopilotStageAction } from "@/app/actions/autopilot";
import type { Stage } from "@/lib/autopilot/stages";
import { RunBadge } from "./run-badge";

export interface RunViewData {
  id: string;
  status: string;
  title: string | null;
  error: string | null;
  costUsd: number;
  maxCostUsd: number;
  createdAt: string;
  updatedAt: string;
  stages: Stage[];
  descriptions: Record<string, string>;
  links: Array<{ label: string; href: string; external?: boolean }>;
  pendingManual: number;
}

const ICON: Record<string, React.ReactNode> = {
  pending: <Circle className="h-5 w-5 text-slate-300" />,
  running: <Loader2 className="h-5 w-5 animate-spin text-amber-600" />,
  waiting: <Pause className="h-5 w-5 text-violet-600" />,
  done: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  skipped: <SkipForward className="h-5 w-5 text-slate-400" />,
  failed: <XCircle className="h-5 w-5 text-red-600" />,
};

function duration(a: string | null, b: string | null) {
  if (!a) return null;
  const ms = (b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime();
  if (ms < 1000) return "< 1 s";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

/** Frise du pilote automatique : 10 étapes, actions, rafraîchissement automatique tant que le run est actif. */
export function AutopilotRunView({ run }: { run: RunViewData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const active = ["RUNNING", "WAITING_INPUT", "WAITING_APPROVAL"].includes(run.status);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [active, router]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      if (!r.ok) setMessage(r.error ?? "Erreur");
      router.refresh();
    });

  const done = run.stages.filter((s) => s.status === "done" || s.status === "skipped").length;
  const current = run.stages.find((s) => s.status !== "done" && s.status !== "skipped");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <RunBadge status={run.status} />
          <span className="text-sm text-slate-600">{done}/{run.stages.length} étapes · coût {usd(run.costUsd)} / plafond {usd(run.maxCostUsd)}</span>
          {active && <span className="text-xs text-slate-400">Actualisation automatique</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            {run.status === "WAITING_APPROVAL" && <Button onClick={() => act(() => approveAutopilotAction(run.id))} disabled={pending}><Play className="h-4 w-4" /> Valider et continuer</Button>}
            {(run.status === "FAILED" || run.status === "CANCELLED" || run.status === "WAITING_INPUT") && <Button variant={run.status === "WAITING_INPUT" ? "secondary" : "default"} onClick={() => act(() => resumeAutopilotAction(run.id))} disabled={pending}><RotateCcw className="h-4 w-4" /> Reprendre</Button>}
            {active && <Button variant="secondary" onClick={() => { if (confirm("Annuler ce run ? Ce qui a déjà été produit est conservé.")) act(() => cancelAutopilotAction(run.id)); }} disabled={pending}>Annuler</Button>}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.round((done / Math.max(1, run.stages.length)) * 100)}%` }} /></div>
        {run.status === "WAITING_INPUT" && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <ClipboardPaste className="h-4 w-4" /> {run.pendingManual > 0 ? `${run.pendingManual} réponse(s) à coller` : "Réponses à coller"} : le run reprendra automatiquement dès qu&apos;elles seront fournies.
            <Link href="/manual" className="ml-auto font-semibold underline">Ouvrir « À coller »</Link>
          </p>
        )}
        {run.status === "WAITING_APPROVAL" && current?.detail && <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">{current.detail}</p>}
        {run.error && run.status === "FAILED" && <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {run.error}</p>}
        {message && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{message}</p>}
        {run.links.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {run.links.map((l) => (
              <Button key={l.href} asChild size="sm" variant="secondary">
                {l.external ? <a href={l.href} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> {l.label}</a> : <Link href={l.href}>{l.label}</Link>}
              </Button>
            ))}
          </div>
        )}
      </div>

      <ol className="space-y-2">
        {run.stages.map((s, i) => (
          <li key={s.key} className={`rounded-xl border bg-white p-4 ${s.status === "failed" ? "border-red-200" : s.status === "running" || s.status === "waiting" ? "border-amber-200" : "border-slate-200"}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{ICON[s.status] ?? <CircleDashed className="h-5 w-5" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-bold">{i + 1}. {s.label}</span>
                  <span className="text-xs text-slate-500">{run.descriptions[s.key]}</span>
                  <span className="ml-auto flex gap-3 text-xs text-slate-500">
                    {duration(s.startedAt, s.finishedAt) && <span>{duration(s.startedAt, s.finishedAt)}</span>}
                    {s.costUsd > 0 && <span>{usd(s.costUsd)}</span>}
                  </span>
                </div>
                {s.detail && <p className="mt-1 text-sm text-slate-700">{s.detail}</p>}
                {s.error && <p className="mt-1 text-sm text-red-700">{s.error}</p>}
              </div>
              {(s.status === "failed" || s.status === "done") && !active && s.key !== "plan" && (
                <Button size="sm" variant="ghost" onClick={() => act(() => retryAutopilotStageAction(run.id, s.key))} disabled={pending}><RotateCcw className="h-3.5 w-3.5" /> Relancer l&apos;étape</Button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
