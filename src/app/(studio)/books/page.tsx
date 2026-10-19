import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ageRangeLabel, ART_STYLES, BOOK_TYPES } from "@/lib/schemas/activity";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const books = await prisma.book.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { activities: true, pages: true, exports: true } } } });
  return (
    <div className="p-8 max-w-6xl">
      <PageHeader title="Livres" description="Tous les projets de livres, en cours et terminés." actions={<Button asChild><Link href="/books/new">Nouveau livre</Link></Button>} />
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Titre</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Âge</th>
              <th className="px-4 py-2">Style</th>
              <th className="px-4 py-2">Activités</th>
              <th className="px-4 py-2">Pages</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Mis à jour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {books.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-4 py-2"><Link href={`/books/${b.id}`} className="font-semibold hover:underline">{b.title}</Link>{b.subtitle && <div className="text-xs text-slate-500">{b.subtitle}</div>}</td>
                <td className="px-4 py-2">{BOOK_TYPES.find((t) => t.key === b.bookType)?.label ?? b.bookType}</td>
                <td className="px-4 py-2">{ageRangeLabel(b.ageRange)}</td>
                <td className="px-4 py-2">{ART_STYLES.find((s) => s.key === b.artStyle)?.label ?? b.artStyle}</td>
                <td className="px-4 py-2">{b._count.activities} / {b.targetCount}</td>
                <td className="px-4 py-2">{b._count.pages}</td>
                <td className="px-4 py-2"><StatusBadge kind="book" status={b.status} /></td>
                <td className="px-4 py-2 text-slate-500">{formatDate(b.updatedAt)}</td>
              </tr>
            ))}
            {books.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Aucun livre pour le moment.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
