import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/page-header";
import { formatUsd, formatDate } from "@/lib/utils";
import { labelFor } from "@/lib/jobs-labels";
import { BookOpen, Sparkles, Library, Palette, FileDown, Settings } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [booksInProgress, booksDone, activitiesGenerated, activitiesValidated, illustrationsToFix, exportsAvailable, cost, jobs, recentBooks] = await Promise.all([
    prisma.book.count({ where: { status: { in: ["DRAFT", "PLANNED", "GENERATING", "REVIEW"] } } }),
    prisma.book.count({ where: { status: { in: ["READY", "EXPORTED"] } } }),
    prisma.activity.count({ where: { currentVersionId: { not: null } } }),
    prisma.activity.count({ where: { status: "VALIDATED" } }),
    prisma.illustration.count({ where: { isCurrent: true, OR: [{ status: "REJECTED" }, { status: "FAILED" }, { isDemo: true, status: { not: "REJECTED" } }] } }),
    prisma.export.count({ where: { status: "COMPLETED" } }),
    prisma.generationLog.aggregate({ _sum: { costUsd: true } }),
    prisma.job.findMany({ where: { parentId: null }, orderBy: { createdAt: "desc" }, take: 8, include: { book: { select: { title: true } }, activity: { select: { title: true } } } }),
    prisma.book.findMany({ orderBy: { updatedAt: "desc" }, take: 6, include: { _count: { select: { activities: true, pages: true } } } }),
  ]);

  const stats = [
    { label: "Livres en cours", value: booksInProgress, href: "/books" },
    { label: "Livres terminés", value: booksDone, href: "/books" },
    { label: "Activités générées", value: activitiesGenerated, href: "/library" },
    { label: "Activités validées", value: activitiesValidated, href: "/library?status=VALIDATED" },
    { label: "Illustrations à corriger", value: illustrationsToFix, href: "/library" },
    { label: "Exports disponibles", value: exportsAvailable, href: "/exports" },
    { label: "Coût IA cumulé", value: formatUsd(Number(cost._sum.costUsd ?? 0)), href: "/settings" },
  ];

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de la production éditoriale." />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { href: "/books/new", label: "Nouveau livre", icon: BookOpen, primary: true },
          { href: "/activities/new", label: "Nouvelle activité", icon: Sparkles },
          { href: "/library", label: "Bibliothèque", icon: Library },
          { href: "/templates", label: "Modèles graphiques", icon: Palette },
          { href: "/exports", label: "Exports", icon: FileDown },
          { href: "/settings", label: "Paramètres", icon: Settings },
        ].map((b) => (
          <Button key={b.href} asChild variant={b.primary ? "default" : "secondary"} size="lg" className="justify-start">
            <Link href={b.href}>
              <b.icon className="h-4 w-4" /> {b.label}
            </Link>
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300">
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </Link>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Livres récents</CardTitle></CardHeader>
          <CardContent>
            {recentBooks.length === 0 && <p className="text-sm text-slate-500">Aucun livre. Lancez l'assistant « Nouveau livre » ou exécutez <code>pnpm db:seed</code> pour le projet de démonstration.</p>}
            <ul className="divide-y divide-slate-100">
              {recentBooks.map((b) => (
                <li key={b.id} className="py-2 flex items-center justify-between gap-3">
                  <Link href={`/books/${b.id}`} className="font-semibold hover:underline truncate">{b.title}</Link>
                  <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                    <span>{b._count.activities} act. · {b._count.pages} p.</span>
                    <StatusBadge kind="book" status={b.status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Historique des tâches</CardTitle></CardHeader>
          <CardContent>
            {jobs.length === 0 && <p className="text-sm text-slate-500">Aucune tâche pour le moment.</p>}
            <ul className="divide-y divide-slate-100">
              {jobs.map((j) => (
                <li key={j.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{labelFor(j.type)} — {j.book?.title ?? j.activity?.title ?? ""}</div>
                    <div className="text-xs text-slate-500 truncate">{j.step ?? ""} · {formatDate(j.createdAt)}</div>
                  </div>
                  <StatusBadge kind="job" status={j.status} />
                </li>
              ))}
            </ul>
            <div className="mt-3"><Link href="/jobs" className="text-sm text-blue-700 hover:underline">Voir toutes les tâches</Link></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
