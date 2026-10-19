import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { AGE_RANGES, ageRangeLabel, difficultyLabel } from "@/lib/schemas/activity";
import { LibraryRowActions } from "@/components/library-row-actions";
import type { ActivityStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const where: Prisma.ActivityWhereInput = {};
  if (sp.q) where.OR = [{ title: { contains: sp.q, mode: "insensitive" } }, { tags: { has: sp.q.toLowerCase() } }, { category: { contains: sp.q, mode: "insensitive" } }];
  if (sp.status) where.status = sp.status as ActivityStatus;
  if (sp.age) where.ageRange = sp.age;
  if (sp.category) where.category = sp.category;
  if (sp.difficulty) where.difficulty = Number(sp.difficulty);
  const [activities, categories, books] = await Promise.all([
    prisma.activity.findMany({ where, orderBy: { updatedAt: "desc" }, take: 300, include: { books: { include: { book: { select: { id: true, title: true } } } }, illustrations: { where: { isCurrent: true }, select: { status: true, isDemo: true, kind: true } }, _count: { select: { issues: { where: { resolved: false, severity: { in: ["ERROR", "BLOCKER"] } } } } } } }),
    prisma.activity.findMany({ distinct: ["category"], select: { category: true } }),
    prisma.book.findMany({ where: { status: { notIn: ["ARCHIVED"] } }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  return (
    <div className="p-8 max-w-7xl">
      <PageHeader title="Bibliothèque" description="Toutes les activités, réutilisables dans plusieurs livres sans régénération." actions={<Button asChild><Link href="/activities/new">Nouvelle activité</Link></Button>} />
      <form className="grid md:grid-cols-6 gap-2 mb-4">
        <Input name="q" placeholder="Rechercher…" defaultValue={sp.q} className="md:col-span-2" />
        <Select name="status" defaultValue={sp.status ?? ""}>
          <option value="">Tous statuts</option>
          {["CONCEPT", "REVIEW", "BLOCKED", "VALIDATED", "ARCHIVED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select name="age" defaultValue={sp.age ?? ""}>
          <option value="">Tous âges</option>
          {AGE_RANGES.map((a) => <option key={a} value={a}>{ageRangeLabel(a)}</option>)}
        </Select>
        <Select name="category" defaultValue={sp.category ?? ""}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
        </Select>
        <div className="flex gap-2">
          <Select name="difficulty" defaultValue={sp.difficulty ?? ""}>
            <option value="">Difficulté</option>
            {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{difficultyLabel(d)}</option>)}
          </Select>
          <Button type="submit" variant="secondary">Filtrer</Button>
        </div>
      </form>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2">Activité</th><th className="px-4 py-2">Catégorie</th><th className="px-4 py-2">Âge</th><th className="px-4 py-2">Difficulté</th><th className="px-4 py-2">Illustrations</th><th className="px-4 py-2">Livres</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activities.map((a) => {
              const accepted = a.illustrations.filter((i) => i.status === "ACCEPTED").length;
              const demo = a.illustrations.filter((i) => i.isDemo).length;
              return (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2"><Link href={`/activities/${a.id}`} className="font-semibold hover:underline">{a.title}</Link>{a._count.issues > 0 && <span className="ml-2 text-xs text-red-700">{a._count.issues} problème(s)</span>}</td>
                  <td className="px-4 py-2">{a.category}</td>
                  <td className="px-4 py-2">{ageRangeLabel(a.ageRange)}</td>
                  <td className="px-4 py-2">{difficultyLabel(a.difficulty)}</td>
                  <td className="px-4 py-2 text-xs">{a.illustrations.length === 0 ? "—" : `${accepted}/${a.illustrations.length} acceptées${demo ? ` · ${demo} démo` : ""}`}</td>
                  <td className="px-4 py-2 text-xs">{a.books.map((b) => <Link key={b.book.id} href={`/books/${b.book.id}`} className="hover:underline mr-1">{b.book.title}</Link>)}</td>
                  <td className="px-4 py-2"><StatusBadge kind="activity" status={a.status} /></td>
                  <td className="px-4 py-2"><LibraryRowActions activityId={a.id} books={books.filter((b) => !a.books.some((x) => x.book.id === b.id))} /></td>
                </tr>
              );
            })}
            {activities.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Aucune activité.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
