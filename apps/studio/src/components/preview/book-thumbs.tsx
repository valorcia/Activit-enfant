"use client";
import Link from "next/link";
import { PageRenderer } from "@/components/page-renderer";
import type { BookThumbData } from "@/lib/preview/thumbs";

/** Vignettes : couverture puis 3 premières pages, cliquables vers l'aperçu. */
export function BookThumbs({ bookId, data, height = 72 }: { bookId: string; data?: BookThumbData; height?: number }) {
  if (!data || !data.pages.length) return <div className="flex items-center justify-center rounded border border-dashed border-slate-200 text-[10px] text-slate-400" style={{ width: Math.round(height * 0.71), height }}>Pas de page</div>;
  const scale = height / (data.heightMm * (96 / 25.4));
  const w = Math.round(data.widthMm * (96 / 25.4) * scale);
  return (
    <Link href={`/books/${bookId}/apercu`} className="group flex items-end gap-1" title="Ouvrir l'aperçu">
      {data.pages.map((p, i) => (
        <div key={i} className={`overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-400 ${i === 0 ? "" : "opacity-90"}`} style={{ width: i === 0 ? w : Math.round(w * 0.8), height: i === 0 ? height : Math.round(height * 0.8) }}>
          <PageRenderer layout={p} theme={data.theme} mode="preview" scale={i === 0 ? scale : scale * 0.8} imageVariant="thumb" />
        </div>
      ))}
    </Link>
  );
}
