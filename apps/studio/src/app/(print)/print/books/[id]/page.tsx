import { prisma } from "@/lib/db";
import { PageRenderer } from "@/components/page-renderer";
import { PrintReady } from "@/components/print-ready";
import { buildContextForBook } from "@/lib/layout/book";
import { PageLayoutSchema, type PageLayout } from "@/lib/schemas/layout";
import { numberPages } from "@/lib/layout/pageNumbers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PrintBookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await buildContextForBook(id).catch(() => null);
  if (!ctx) notFound();

  let pages: { id: string; layout: PageLayout; templateKey: string }[];
  if (sp.snapshot) {
    const snap = await prisma.bookSnapshot.findUnique({ where: { id: sp.snapshot } });
    if (!snap) notFound();
    const data = snap.data as { pages: { id: string; layout: unknown; templateKey: string }[] };
    pages = data.pages.map((p) => ({ id: p.id, templateKey: p.templateKey, layout: PageLayoutSchema.parse(p.layout) }));
  } else {
    const rows = await prisma.bookPage.findMany({ where: { bookId: id }, orderBy: { position: "asc" } });
    pages = rows.map((p) => ({ id: p.id, templateKey: p.templateKey, layout: PageLayoutSchema.parse(p.layout) }));
  }
  if (sp.only === "cover") pages = pages.filter((p) => p.templateKey === "cover" || p.templateKey === "back_cover");
  const numbers = numberPages(pages);

  return (
    <>
      <style>{`@page { size: ${ctx.widthMm}mm ${ctx.heightMm}mm; margin: 0; } html, body { margin: 0; padding: 0; }`}</style>
        <div className="print-root">
          {pages.map((p, i) => (
            <PageRenderer key={p.id} layout={p.layout} theme={ctx.theme} mode="print" pageIndex={i} pageNumber={numbers[i]} />
          ))}
        </div>
      <PrintReady />
    </>
  );
}
