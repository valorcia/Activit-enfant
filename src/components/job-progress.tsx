"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, XCircle, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { jobAction } from "@/app/actions/books";
import { formatUsd } from "@/lib/utils";
import { labelFor } from "@/lib/jobs-labels";

export interface JobView {
  id: string;
  type: string;
  status: string;
  progress: number;
  step: string | null;
  error: string | null;
  costUsd: number;
  createdAt: string;
  children?: (JobView & { activity?: { title: string } | null })[];
  logs?: { id: string; level: string; message: string; createdAt: string }[];
}

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export function useJob(jobId: string | null, onDone?: (job: JobView) => void) {
  const [job, setJob] = useState<JobView | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let doneCalled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as JobView;
          if (!stop) setJob(j);
          if (TERMINAL.has(j.status) && !doneCalled) {
            doneCalled = true;
            onDone?.(j);
            return;
          }
        }
      } catch {
        /* réseau : on réessaie */
      }
      if (!stop) setTimeout(tick, 2000);
    };
    tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
  return job;
}

export function JobProgress({ jobId, title, onDone, compact }: { jobId: string; title?: string; onDone?: () => void; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const job = useJob(jobId, () => {
    router.refresh();
    onDone?.();
  });
  if (!job) return <div className="text-sm text-slate-500">Chargement de la tâche…</div>;
  const active = !TERMINAL.has(job.status);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{title ?? labelFor(job.type)}</div>
          <div className="text-xs text-slate-500 truncate">{job.step ?? "—"}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge kind="job" status={job.status} />
          {job.costUsd > 0 && <span className="text-xs text-slate-500">{formatUsd(job.costUsd)}</span>}
        </div>
      </div>
      <Progress value={job.progress} color={job.status === "FAILED" ? "bg-red-500" : job.status === "COMPLETED" ? "bg-emerald-500" : "bg-blue-600"} />
      {job.error && <div className="text-xs text-red-700 bg-red-50 rounded p-2 whitespace-pre-wrap">{job.error}</div>}
      {!compact && job.children && job.children.length > 0 && (
        <ul className="text-xs space-y-1 max-h-48 overflow-auto">
          {job.children.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{c.activity?.title ?? labelFor(c.type)} — {c.step ?? ""}</span>
              <StatusBadge kind="job" status={c.status} />
            </li>
          ))}
        </ul>
      )}
      {(active || job.status === "FAILED") && (
        <div className="flex gap-2">
          {job.status === "RUNNING" && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => jobAction(job.id, "pause"))}>
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          )}
          {job.status === "PAUSED" && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => jobAction(job.id, "resume"))}>
              <Play className="h-3.5 w-3.5" /> Reprendre
            </Button>
          )}
          {active && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => jobAction(job.id, "cancel"))}>
              <XCircle className="h-3.5 w-3.5" /> Annuler
            </Button>
          )}
          {job.status === "FAILED" && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => jobAction(job.id, "retry"))}>
              <RotateCcw className="h-3.5 w-3.5" /> Relancer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export { labelFor };
