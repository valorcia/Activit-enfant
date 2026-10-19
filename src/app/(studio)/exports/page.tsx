import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { EXPORT_LABELS } from "@/lib/export/labels";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const exports = await prisma.export.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { book: { select: { title: true, id: true } }, snapshot: { select: { version: true } } } });
  const activities = await prisma.activity.findMany({ where: { id: { in: exports.map((e) => e.activityId).filter(Boolean) as string[] } }, select: { id: true, title: true } });
  const titleOf = (id: string | null) => activities.find((a) => a.id === id)?.title;
  return (
    <div className="p-8 max-w-6xl">
      <PageHeader title="Exports" description="Historique des PDF produits. Chaque export de livre est lié à une version figée (snapshot) et reste reproductible." />
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2">Type</th><th className="px-4 py-2">Cible</th><th className="px-4 py-2">Version</th><th className="px-4 py-2">Pages</th><th className="px-4 py-2">Contrôles</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2">Date</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {exports.map((e) => {
              const checks = (e.checks ?? {}) as { ok?: boolean; missingImages?: number; overflows?: unknown[]; pageCountOk?: boolean };
              return (
                <tr key={e.id}>
                  <td className="px-4 py-2 font-semibold">{EXPORT_LABELS[e.kind]}</td>
                  <td className="px-4 py-2">{e.book ? <Link href={`/books/${e.book.id}`} className="hover:underline">{e.book.title}</Link> : titleOf(e.activityId) ?? "—"}</td>
                  <td className="px-4 py-2">{e.snapshot ? `v${e.snapshot.version}` : "—"}</td>
                  <td className="px-4 py-2">{e.pageCount ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {e.status === "COMPLETED" && (checks.ok ? <span className="text-emerald-700">OK</span> : <span className="text-amber-700">{checks.missingImages ? `${checks.missingImages} image(s) manquante(s) ` : ""}{checks.overflows?.length ? `${checks.overflows.length} débordement(s) ` : ""}{checks.pageCountOk === false ? "nombre de pages inattendu" : ""}</span>)}
                    {e.error && <span className="text-red-700">{e.error.slice(0, 100)}</span>}
                  </td>
                  <td className="px-4 py-2"><StatusBadge kind="export" status={e.status} /></td>
                  <td className="px-4 py-2 text-xs">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-2">{e.assetId && <a className="text-blue-700 hover:underline" href={`/api/assets/${e.assetId}`} target="_blank">Télécharger</a>}</td>
                </tr>
              );
            })}
            {exports.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Aucun export.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
