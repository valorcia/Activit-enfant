import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadBookPreview } from "@/lib/preview/data";
import { BookViewer } from "@/components/preview/book-viewer";

export const dynamic = "force-dynamic";

/** Aperçu du livre tel qu'il sera imprimé (même rendu que le PDF), avec contrôles et actions. */
export default async function BookPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadBookPreview(id);
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-[1500px] p-3 sm:p-6">
      <Link href={`/books/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Retour au livre</Link>
      {data.pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <h1 className="mb-2 text-xl font-black text-slate-800">{data.book.title}</h1>
          Aucune page assemblée pour l'instant : lancez la production ou « Assembler les pages » depuis la fiche du livre.
        </div>
      ) : (
        <BookViewer data={data} />
      )}
    </div>
  );
}
