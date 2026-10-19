"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { JobProgress } from "@/components/job-progress";
import { requestExport } from "@/app/actions/books";
import { EXPORT_LABELS } from "@/lib/export/labels";
import { formatDate } from "@/lib/utils";
import type { BookView, ExportRow } from "./book-tabs";
import type { ExportKind } from "@prisma/client";

export function ExportsTab({ book, exports, snapshots }: { book: BookView; exports: ExportRow[]; snapshots: { id: string; version: number; label: string | null; createdAt: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobs, setJobs] = useState<string[]>([]);
  const launch = (kinds: ExportKind[]) => start(async () => {
    const ids: string[] = [];
    for (const kind of kinds) ids.push((await requestExport({ kind, bookId: book.id })).jobId);
    setJobs((j) => [...ids, ...j]);
  });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold mb-2">Nouvel export</h3>
        <p className="text-sm text-slate-600 mb-3">Chaque export de livre fige une version (snapshot) : il peut être reproduit à l'identique plus tard. Les polices sont intégrées et les images vérifiées.</p>
        <div className="flex flex-wrap gap-2">
          {(["BOOK_PRINT", "BOOK_DIGITAL", "COVER", "ACTIVITY_SHEETS"] as ExportKind[]).map((k) => (
            <Button key={k} variant="secondary" disabled={pending} onClick={() => launch([k])}>{EXPORT_LABELS[k]}</Button>
          ))}
          <Button disabled={pending} onClick={() => launch(["BOOK_PRINT", "BOOK_DIGITAL", "COVER"])}>Export par lot (imprimable + numérique + couverture)</Button>
        </div>
      </div>
      {jobs.map((j) => <JobProgress key={j} jobId={j} title="Export PDF" compact onDone={() => router.refresh()} />)}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Type</th><th className="px-4 py-2">Version</th><th className="px-4 py-2">Pages</th><th className="px-4 py-2">Contrôles</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2">Date</th><th className="px-4 py-2"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {exports.map((e) => {
              const ch = (e.checks ?? {}) as { ok?: boolean; missingImages?: number; overflows?: unknown[]; pageCountOk?: boolean; fonts?: string[] };
              const snap = snapshots.find((s) => s.id === e.snapshotId);
              return (
                <tr key={e.id}>
                  <td className="px-4 py-2 font-semibold">{EXPORT_LABELS[e.kind]}</td>
                  <td className="px-4 py-2">{snap ? `v${snap.version}` : "—"}</td>
                  <td className="px-4 py-2">{e.pageCount ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {e.status === "COMPLETED" && (ch.ok ? <span className="text-emerald-700">OK · polices : {(ch.fonts ?? []).join(", ") || "système"}</span> : <span className="text-amber-700">{ch.missingImages ? `${ch.missingImages} image(s) manquante(s) ` : ""}{ch.overflows?.length ? `${ch.overflows.length} débordement(s) ` : ""}{ch.pageCountOk === false ? "nombre de pages inattendu" : ""}</span>)}
                    {e.error && <span className="text-red-700">{e.error}</span>}
                  </td>
                  <td className="px-4 py-2"><StatusBadge kind="export" status={e.status} /></td>
                  <td className="px-4 py-2 text-xs">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-2">{e.assetId && <a href={`/api/assets/${e.assetId}`} target="_blank" className="text-blue-700 hover:underline">Télécharger</a>}</td>
                </tr>
              );
            })}
            {exports.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Aucun export.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
