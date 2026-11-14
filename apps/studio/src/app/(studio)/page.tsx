import Link from "next/link";
import { firstPagesFor } from "@/lib/preview/thumbs";
import { BookThumbs } from "@/components/preview/book-thumbs";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/page-header";
import { formatUsd, formatDate } from "@/lib/utils";
import { labelFor } from "@/lib/jobs-labels";
import { BookOpen, Sparkles, Library, Settings, Wand2, Store, Rocket } from "lucide-react";
import { RunBadge } from "@/components/autopilot/run-badge";
import { currentStage, parseStages } from "@/lib/autopilot/stages";
import { ShopPanel } from "@/components/shop/shop-panel";
import { kitLabel } from "@/lib/kits/types";

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

  const thumbs = await firstPagesFor(recentBooks.map((b) => b.id));
  const runs = await prisma.autopilotRun.findMany({ orderBy: { createdAt: "desc" }, take: 4, include: { book: { select: { title: true } } } });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de la production éditoriale." />
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black text-emerald-950">Lancer un nouvel e-book</h2>
          <p className="mt-1 text-sm text-emerald-900">Collez votre brief (ou le JSON obtenu avec les prompts) : le pilote automatique rédige, illustre, met en page, exporte, publie dans la boutique, crée les vidéos et la campagne publicitaire.</p>
          {runs.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {runs.map((r) => { const cur = currentStage(parseStages(r.stages)); return (
                <li key={r.id} className="flex flex-wrap items-center gap-2"><RunBadge status={r.status} /><Link href={`/autopilot/${r.id}`} className="font-semibold text-emerald-950 hover:underline">{r.book?.title ?? r.title ?? "Sans titre"}</Link>{cur && r.status !== "COMPLETED" && <span className="text-xs text-slate-500">{cur.label}</span>}</li>
              ); })}
            </ul>
          )}
        </div>
        <Button asChild size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"><Link href="/brief"><Rocket className="h-4 w-4" /> Lancer un nouvel e-book</Link></Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { href: "/books/new", label: "Nouveau kit", icon: BookOpen, primary: true },
          { href: "/brief", label: "Créer depuis un brief", icon: Wand2 },
          { href: "/shop", label: "Boutique", icon: Store },
          { href: "/activities/new", label: "Nouvelle activité", icon: Sparkles },
          { href: "/library", label: "Bibliothèque", icon: Library },
          { href: "/settings", label: "Paramètres", icon: Settings },
        ].map((b) => (
          <Button key={b.href} asChild variant={b.primary ? "default" : "secondary"} size="lg" className="h-auto min-h-11 justify-start whitespace-normal py-2 text-left">
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
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <ShopPanel />
        <Card>
          <CardHeader><CardTitle>Livres récents</CardTitle></CardHeader>
          <CardContent>
            {recentBooks.length === 0 && <p className="text-sm text-slate-500">Aucun livre. Lancez l'assistant « Nouveau livre » ou exécutez <code>pnpm db:seed</code> pour le projet de démonstration.</p>}
            <ul className="divide-y divide-slate-100">
              {recentBooks.map((b) => (
                <li key={b.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <BookThumbs bookId={b.id} data={thumbs[b.id]} height={56} />
                    <Link href={`/books/${b.id}`} className="font-semibold hover:underline truncate">{b.title}</Link>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                    <span>{kitLabel(b.kitType)} · {b._count.pages} p.</span>
                    <StatusBadge kind="book" status={b.status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
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
