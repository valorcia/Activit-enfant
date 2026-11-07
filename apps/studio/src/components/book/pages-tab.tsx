"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { PageRenderer } from "@/components/page-renderer";
import { JobProgress } from "@/components/job-progress";
import { queueLayout, saveBookTheme } from "@/app/actions/books";
import { BUILTIN_TEMPLATES } from "@/lib/layout/themes";
import { numberPages } from "@/lib/layout/pageNumbers";
import { PAGE_TEMPLATES } from "@/lib/schemas/layout";
import type { BookView, PageRow } from "./book-tabs";

export function PagesTab({ book, pages }: { book: BookView; pages: PageRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState(book.theme.templateKey);
  const numbers = numberPages(pages);
  const scale = 180 / (book.widthMm * 3.7795);
  const locked = pages.filter((p) => p.locked).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || Boolean(jobId)} onClick={() => start(async () => { const r = await queueLayout(book.id, false); setJobId(r.jobId); })}>Assembler / mettre à jour les pages</Button>
        <Button size="sm" variant="secondary" disabled={pending || Boolean(jobId)} onClick={() => { if (confirm(`Reconstruire toutes les pages, y compris les ${locked} page(s) modifiée(s) manuellement ?`)) start(async () => { const r = await queueLayout(book.id, true); setJobId(r.jobId); }); }}>Tout reconstruire</Button>
        <Button asChild size="sm" variant="secondary"><Link href={`/books/${book.id}/editor`}>Ouvrir l'éditeur visuel</Link></Button>
        <div className="flex items-center gap-2 ml-auto text-sm">
          <span className="text-slate-500">Modèle graphique</span>
          <Select className="w-44 h-8" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
            {BUILTIN_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </Select>
          <Button size="sm" variant="secondary" disabled={pending || templateKey === book.theme.templateKey} onClick={() => start(async () => { const t = BUILTIN_TEMPLATES.find((x) => x.key === templateKey)!; await saveBookTheme(book.id, t.theme); const r = await queueLayout(book.id, false); setJobId(r.jobId); })}>Appliquer</Button>
        </div>
      </div>
      {jobId && <JobProgress jobId={jobId} title="Mise en page" onDone={() => { setJobId(null); router.refresh(); }} />}
      {pages.length === 0 && <p className="text-sm text-slate-500 rounded-lg border border-dashed p-6 text-center">Aucune page. Lancez « Assembler les pages » une fois des fiches rédigées.</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        {pages.map((p, i) => (
          <Link key={p.id} href={`/books/${book.id}/editor?page=${i}`} className="group">
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm group-hover:border-blue-400" style={{ width: 180, height: Math.round(180 * (book.heightMm / book.widthMm)) }}>
              <PageRenderer layout={p.layout} theme={book.theme} mode="preview" scale={scale} pageNumber={numbers[i]} />
            </div>
            <div className="text-xs mt-1 text-slate-600 truncate">{i + 1}. {PAGE_TEMPLATES.find((t) => t.key === p.templateKey)?.name ?? p.templateKey}{p.locked ? " · modifiée" : ""}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
