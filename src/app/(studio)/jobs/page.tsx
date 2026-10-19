import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { labelFor } from "@/lib/jobs-labels";
import { JobActions } from "@/components/job-actions";
import { formatDate, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { book: { select: { title: true, id: true } }, activity: { select: { title: true, id: true } }, logs: { where: { level: "error" }, take: 1, orderBy: { createdAt: "desc" } } } });
  return (
    <div className="p-8 max-w-6xl">
      <PageHeader title="Tâches" description="Historique de toutes les tâches asynchrones (le worker doit tourner : pnpm worker)." />
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2">Tâche</th><th className="px-4 py-2">Cible</th><th className="px-4 py-2">Étape</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2">Coût</th><th className="px-4 py-2">Créée</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((j) => (
              <tr key={j.id} className={j.parentId ? "text-slate-500" : ""}>
                <td className="px-4 py-2">{j.parentId && <span className="text-slate-300 mr-1">↳</span>}{labelFor(j.type)}</td>
                <td className="px-4 py-2">{j.activity ? <Link className="hover:underline" href={`/activities/${j.activity.id}`}>{j.activity.title}</Link> : j.book ? <Link className="hover:underline" href={`/books/${j.book.id}`}>{j.book.title}</Link> : "—"}</td>
                <td className="px-4 py-2 max-w-xs truncate">{j.error ? <span className="text-red-700">{j.error.slice(0, 120)}</span> : j.step}</td>
                <td className="px-4 py-2"><StatusBadge kind="job" status={j.status} /> <span className="text-xs">{j.progress}%</span></td>
                <td className="px-4 py-2">{formatUsd(Number(j.costUsd))}</td>
                <td className="px-4 py-2 text-xs">{formatDate(j.createdAt)}</td>
                <td className="px-4 py-2"><JobActions id={j.id} status={j.status} /></td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Aucune tâche.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
