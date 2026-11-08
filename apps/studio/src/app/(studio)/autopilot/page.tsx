import Link from "next/link";
import { Rocket } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { RunBadge } from "@/components/autopilot/run-badge";
import { currentStage, parseStages } from "@/lib/autopilot/stages";
import { formatDate, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AutopilotPage() {
  const runs = await prisma.autopilotRun.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { book: { select: { id: true, title: true } } } });
  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        title="Pilote automatique"
        description="Un brief → rédaction, illustrations, mise en page, PDF, boutique, vidéos et publicités, sans intervention."
        actions={<Button asChild><Link href="/brief"><Rocket className="h-4 w-4" /> Lancer un nouvel e-book</Link></Button>}
      />
      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          <p className="font-semibold">Aucun run pour l&apos;instant.</p>
          <p className="mt-1 text-sm">Collez un brief (ou le JSON produit avec les prompts de docs/prompts) et cliquez sur « Tout lancer en automatique ».</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">E-book</th><th className="p-3">Statut</th><th className="p-3">Étape</th><th className="p-3">Coût</th><th className="p-3">Lancé le</th></tr></thead>
            <tbody>
              {runs.map((r) => {
                const stages = parseStages(r.stages);
                const cur = currentStage(stages);
                const done = stages.filter((s) => s.status === "done" || s.status === "skipped").length;
                return (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3"><Link href={`/autopilot/${r.id}`} className="font-semibold text-blue-700 hover:underline">{r.book?.title ?? r.title ?? "Sans titre"}</Link></td>
                    <td className="p-3"><RunBadge status={r.status} /></td>
                    <td className="p-3 text-slate-600">{r.status === "COMPLETED" ? `${done}/${stages.length} étapes` : cur ? `${cur.label}${cur.detail ? ` — ${cur.detail}` : ""}` : "—"}</td>
                    <td className="p-3">{formatUsd(Number(r.costUsd))}</td>
                    <td className="p-3 text-slate-500">{formatDate(r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
