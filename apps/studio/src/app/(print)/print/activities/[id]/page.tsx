import { PageRenderer } from "@/components/page-renderer";
import { PrintReady } from "@/components/print-ready";
import { buildStandaloneActivityPages } from "@/lib/layout/book";
import { numberPages } from "@/lib/layout/pageNumbers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PrintActivityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const built = await buildStandaloneActivityPages(id, sp.book).catch(() => null);
  if (!built) notFound();
  const numbers = numberPages(built.pages);
  return (
    <>
      <style>{`@page { size: ${built.ctx.widthMm}mm ${built.ctx.heightMm}mm; margin: 0; } html, body { margin: 0; padding: 0; }`}</style>
        <div className="print-root">
          {built.pages.map((p, i) => (
            <PageRenderer key={i} layout={p.layout} theme={built.ctx.theme} mode="print" pageIndex={i} pageNumber={numbers[i]} />
          ))}
        </div>
      <PrintReady />
    </>
  );
}
