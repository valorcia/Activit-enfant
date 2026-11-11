"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Layers, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { JobProgress } from "@/components/job-progress";
import { importKitJsonAction, regenerateKitContentAction, regenerateKitSlotAction } from "@/app/actions/kits";
import { queueLayout, startPipeline } from "@/app/actions/books";
import { ImageToolsDialog } from "@/components/preview/image-tools";
import type { FramingTarget } from "@/components/preview/framing-editor";

export interface KitTabView {
  typeLabel: string;
  countLabel: string;
  sections: Array<{ label: string; count?: number | null }>;
  customization: Record<string, unknown>;
  hasContent: boolean;
  heroName: string | null;
  elements: Array<{ title: string; detail: string }>;
  slots: Array<{ slot: string; label: string; status: string | null; src: string | null; isDemo: boolean; provider: string | null; isSketch?: boolean; framing?: FramingTarget | null }>;
}

/** Onglet « Kit » : contenu structuré, personnalisation, illustrations par emplacement, production. */
export function KitTab({ bookId, kit, activeJobId }: { bookId: string; kit: KitTabView; activeJobId: string | null }) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(activeJobId);
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [tool, setTool] = useState<{ ill: FramingTarget; isSketch: boolean } | null>(null);
  const done = kit.slots.filter((s) => s.status === "GENERATED" || s.status === "ACCEPTED").length;
  // Grands volumes (120 dessins…) : filtre et pagination de la liste d'illustrations
  const [filter, setFilter] = useState<"all" | "todo" | "done" | "demo" | "sketch">("all");
  const [pageNo, setPageNo] = useState(0);
  const PER_PAGE = 48;
  const filtered = kit.slots.filter((s) => {
    const ok = s.status === "GENERATED" || s.status === "ACCEPTED";
    return filter === "all" || (filter === "todo" && !ok) || (filter === "done" && ok) || (filter === "demo" && s.isDemo) || (filter === "sketch" && s.isSketch);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const visible = filtered.slice(Math.min(pageNo, pageCount - 1) * PER_PAGE, (Math.min(pageNo, pageCount - 1) + 1) * PER_PAGE);

  const act = (fn: () => Promise<{ jobId: string } | void>, ok?: string) =>
    start(async () => {
      setError(null);
      setMessage(null);
      try {
        const r = await fn();
        if (r && "jobId" in r) setJobId(r.jobId);
        if (ok) setMessage(ok);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

  const c = kit.customization;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{kit.typeLabel}</div>
          <div className="mt-1 text-sm leading-relaxed">
            {[c.universe && `Univers : ${c.universe}`, (kit.heroName || c.heroName) && `Personnage : ${kit.heroName || c.heroName}`, c.companion && `Compagnon : ${c.companion}`, c.place && `Lieu : ${c.place}`, c.tone && `Ton : ${c.tone}`].filter(Boolean).join(" · ") || "Personnalisation par défaut"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">{kit.sections.map((s) => <Badge key={s.label} variant="secondary">{s.count ? `${s.count} · ` : ""}{s.label}</Badge>)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <Button className="w-full" disabled={pending || !!jobId} onClick={() => act(() => startPipeline(bookId, { withIllustrations: true, withCover: true }).then((r) => ({ jobId: r.jobId })))}><Play className="h-4 w-4" /> {kit.hasContent ? "Produire illustrations et pages" : "Lancer toute la production"}</Button>
          <Button className="w-full" variant="secondary" disabled={pending || !!jobId} onClick={() => act(() => regenerateKitContentAction(bookId))}><RefreshCw className="h-4 w-4" /> {kit.hasContent ? "Réécrire le contenu" : "Rédiger le contenu seulement"}</Button>
          <Button className="w-full" variant="secondary" disabled={pending || !kit.hasContent} onClick={() => act(() => queueLayout(bookId, true), "Assemblage des pages lancé")}><Layers className="h-4 w-4" /> Réassembler les pages</Button>
        </div>
      </div>

      {jobId && <JobProgress jobId={jobId} title="Production du kit" onDone={() => { setJobId(null); router.refresh(); }} />}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-bold">Contenu {kit.hasContent ? `(${kit.elements.length} ${kit.countLabel})` : ""}</h3>
        {kit.hasContent ? (
          <ol className="mt-3 grid gap-2 md:grid-cols-2">
            {kit.elements.map((e, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-semibold">{i + 1}. {e.title}</div>
                <div className="mt-0.5 line-clamp-3 text-slate-600">{e.detail}</div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Pas encore de contenu : lancez la production, ou collez ci-dessous le JSON obtenu dans Claude ou ChatGPT avec un prompt de <code>docs/prompts</code>.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Illustrations ({done}/{kit.slots.length})</h3>
          {kit.slots.length > 12 && (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {([["all", "Toutes"], ["todo", "À générer"], ["done", "Faites"], ["demo", "Démo"], ["sketch", "Esquisses"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setFilter(k); setPageNo(0); }} className={`rounded-full px-2 py-0.5 ${filter === k ? "bg-slate-800 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>{l}</button>
              ))}
              {pageCount > 1 && (
                <span className="ml-2 flex items-center gap-1">
                  <button type="button" disabled={pageNo === 0} onClick={() => setPageNo((n) => Math.max(0, n - 1))} className="rounded px-1.5 hover:bg-slate-100 disabled:opacity-40">‹</button>
                  {Math.min(pageNo, pageCount - 1) + 1}/{pageCount}
                  <button type="button" disabled={pageNo >= pageCount - 1} onClick={() => setPageNo((n) => Math.min(pageCount - 1, n + 1))} className="rounded px-1.5 hover:bg-slate-100 disabled:opacity-40">›</button>
                </span>
              )}
            </div>
          )}
        </div>
        {kit.slots.length === 0 ? <p className="mt-2 text-sm text-slate-500">La liste des illustrations apparaît une fois le contenu rédigé.</p> : (
          <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {visible.map((s) => (
              <li key={s.slot} className="overflow-hidden rounded-lg border border-slate-200">
                <div className="relative aspect-square bg-slate-100">
                  {s.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.src.startsWith("/api/assets/") ? `${s.src}?v=thumb` : s.src} alt={s.label} loading="lazy" className="h-full w-full object-contain" />
                  ) : <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-slate-400">À générer</div>}
                  {s.isDemo && <span className="absolute left-1 top-1 rounded bg-red-600 px-1 text-[9px] font-bold text-white">DÉMO</span>}
                  {s.isSketch && <span className="absolute right-1 top-1 rounded bg-amber-400 px-1 text-[9px] font-bold text-amber-950">ESQUISSE</span>}
                </div>
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <span className="truncate text-[11px] font-semibold" title={s.label}>{s.label}</span>
                  {s.framing ? (
                    <button className="text-[10px] font-semibold text-blue-700 hover:underline" onClick={() => setTool({ ill: s.framing!, isSketch: !!s.isSketch })}>Cadrer · refaire</button>
                  ) : s.src ? (
                    <button className="text-[10px] text-blue-700 hover:underline" disabled={pending || !!jobId} onClick={() => { if (confirm("Regénérer cette illustration ? Une nouvelle image sera payée.")) act(() => regenerateKitSlotAction(bookId, s.slot)); }}>Refaire</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <h3 className="font-bold">Coller un contenu complet (JSON)</h3>
        <p className="text-sm text-slate-500">Remplace le contenu du kit par la réponse JSON de Claude ou ChatGPT (énigmes, idées, lettres, guide, fiche boutique). Les illustrations existantes sont conservées.</p>
        <Textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} className="font-mono text-xs" placeholder='{ "titre": "…", "enigmes": [ … ] }' />
        <Button variant="secondary" disabled={pending || paste.trim().length < 20} onClick={() => start(async () => {
          setError(null);
          const r = await importKitJsonAction(bookId, paste);
          if (!r.ok) { setError(r.error); return; }
          setPaste("");
          setMessage(`Contenu importé : ${r.count} ${kit.countLabel}.`);
          router.refresh();
        })}><ClipboardPaste className="h-4 w-4" /> Importer le JSON</Button>
      </div>

      {tool && <ImageToolsDialog ill={tool.ill} isSketch={tool.isSketch} open onOpenChange={(o) => { if (!o) { setTool(null); router.refresh(); } }} />}
      {message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}
