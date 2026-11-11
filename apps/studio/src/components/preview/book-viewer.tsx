"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Copy, Download, FileDown, FileText, LayoutGrid, Maximize2, Minimize2, Pencil, RefreshCw, ScanEye, Share2, Sparkles, Store, Crop, Upload, TriangleAlert } from "lucide-react";
import { PageRenderer } from "@/components/page-renderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobProgress } from "@/components/job-progress";
import { ImageToolsDialog, type ImageToolTab } from "./image-tools";
import { requestExport } from "@/app/actions/books";
import { publishToShopAction } from "@/app/actions/shop";
import { createPreviewLinkAction, finalizeSketchesAction } from "@/app/actions/images";
import { formatUsd } from "@/lib/utils";
import type { BookPreviewData } from "@/lib/preview/data";
import type { ImageIssue } from "@/lib/quality/images";

const PX_PER_MM = 96 / 25.4;
const BLEED_MM = 3;
type Zoom = "fit" | 1 | 2;
type LayoutMode = "auto" | "single" | "double";

interface PageBadge {
  key: string;
  severity: "info" | "warning" | "blocking";
  label: string;
  blockId?: string;
  illustrationId?: string;
  actions: Array<ImageToolTab | "texte">;
}

const SEVERITY_CLASS: Record<PageBadge["severity"], string> = {
  blocking: "bg-red-600 text-white",
  warning: "bg-amber-400 text-amber-950",
  info: "bg-sky-100 text-sky-900",
};

function issueBadge(i: ImageIssue): PageBadge {
  const short: Record<ImageIssue["code"], string> = {
    missing: "Image manquante",
    dpi_low: `Basse résolution (${i.dpi} ppp)`,
    dpi_blocking: `Résolution insuffisante (${i.dpi} ppp)`,
    ratio_mismatch: "Recadrage conseillé",
    auto_contain: "Image ajustée",
    uniform: "Image presque unie",
    sketch: "Esquisse",
    demo: "Démo",
  };
  return { key: `${i.code}-${i.blockId}`, severity: i.severity, label: short[i.code], blockId: i.blockId, illustrationId: i.illustrationId, actions: i.actions };
}

/**
 * Visionneuse de livre : double page (couverture seule), tourne-page léger, clavier, glisser,
 * miniatures, zoom, plein écran, page simple sur mobile. Même moteur de rendu que le PDF.
 * Le calque « Contrôles » montre marges de sécurité, fond perdu, cadres d'image et alertes.
 */
export function BookViewer({ data, readOnly = false }: { data: BookPreviewData; readOnly?: boolean }) {
  const router = useRouter();
  const { pages, widthMm, heightMm, theme } = data;
  const [cur, setCur] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("auto");
  const [controls, setControls] = useState(!readOnly);
  const [thumbs, setThumbs] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [stage, setStage] = useState({ w: 1000, h: 700 });
  const [overflows, setOverflows] = useState<Map<number, string[]>>(new Map());
  const [tool, setTool] = useState<{ illustrationId: string; frame?: { w: number; h: number }; tab: ImageToolTab } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const double = layoutMode === "double" || (layoutMode === "auto" && stage.w >= 760);
  const spreads = useMemo(() => {
    if (!double) return pages.map((_, i) => [i]);
    const out: number[][] = pages.length ? [[0]] : [];
    for (let i = 1; i < pages.length; i += 2) out.push(i + 1 < pages.length ? [i, i + 1] : [i]);
    return out;
  }, [pages, double]);
  const spreadIndex = Math.max(0, spreads.findIndex((s) => s.includes(cur)));
  const spread = spreads[spreadIndex] ?? [];

  const pageW = widthMm * PX_PER_MM;
  const pageH = heightMm * PX_PER_MM;
  const slots = double ? 2 : 1;
  const fitScale = Math.max(0.1, Math.min((stage.w - 32 - (slots - 1) * 2) / (slots * pageW), (stage.h - 32) / pageH));
  const scale = zoom === "fit" ? fitScale : zoom;

  // Taille disponible (redimensionnement, plein écran, rotation du téléphone)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const go = useCallback((delta: number) => {
    const next = spreads[Math.min(spreads.length - 1, Math.max(0, spreadIndex + delta))];
    if (!next || next[0] === spread[0]) return;
    setDir(delta > 0 ? "next" : "prev");
    setCur(next[0]);
  }, [spreads, spreadIndex, spread]);
  const goToPage = (i: number) => {
    setDir(i >= cur ? "next" : "prev");
    setCur(i);
  };

  // Clavier : flèches, Page précédente/suivante, Début/Fin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (tool || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Home") { e.preventDefault(); goToPage(0); }
      else if (e.key === "End") { e.preventDefault(); goToPage(pages.length - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Débordements de texte : même règle que l'export PDF, mesurée sur les miniatures (toutes les pages)
  // Miniatures rendues à la demande (livres de 100+ pages) : la mesure se refait quand de nouvelles miniatures apparaissent
  const [shownTick, setShownTick] = useState(0);
  const onThumbShown = useCallback(() => setShownTick((t) => t + 1), []);
  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      const root = thumbsRef.current;
      if (!root || cancelled) return;
      setOverflows((prev) => {
        const map = new Map(prev);
        root.querySelectorAll<HTMLElement>("[data-page-index]").forEach((pg) => {
          const idx = Number(pg.dataset.pageIndex);
          const ids: string[] = [];
          pg.querySelectorAll<HTMLElement>("[data-block-id]").forEach((el) => {
            if (el.dataset.blockType === "image" || el.dataset.blockType === "shape") return;
            const inner = el.querySelector<HTMLElement>("[data-measure]") ?? el;
            if (inner.scrollHeight > el.clientHeight + 3) ids.push(el.dataset.blockId!);
          });
          if (ids.length) map.set(idx, ids);
          else map.delete(idx);
        });
        return map;
      });
    };
    const t = setTimeout(() => document.fonts.ready.then(() => setTimeout(measure, 150)), 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pages, shownTick]);

  const badgesByPage = useMemo(() => {
    const m = new Map<number, PageBadge[]>();
    for (const i of data.issues) {
      // « Ajustée » et « Démo » sont déjà visibles sur l'image : pas d'entrée dans la liste d'alertes
      if (i.code === "auto_contain" || i.code === "demo") continue;
      m.set(i.pageIndex, [...(m.get(i.pageIndex) ?? []), issueBadge(i)]);
    }
    for (const [idx, ids] of overflows) m.set(idx, [...(m.get(idx) ?? []), ...ids.map((id) => ({ key: `of-${id}`, severity: "blocking" as const, label: "Texte qui déborde", blockId: id, actions: ["texte" as const] }))]);
    return m;
  }, [data.issues, overflows]);

  const totalAlerts = [...badgesByPage.values()].flat().filter((b) => b.severity !== "info").length;

  const openTool = (illustrationId: string | undefined, blockId: string | undefined, pageIndex: number, tab: ImageToolTab) => {
    if (readOnly || !illustrationId || !data.illustrations[illustrationId]) return;
    const block = pages[pageIndex]?.layout.blocks.find((b) => b.id === blockId);
    setTool({ illustrationId, frame: block ? { w: block.w, h: block.h } : undefined, tab });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else rootRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const pageLabel = spread.length === 2 ? `Pages ${spread[0] + 1}–${spread[1] + 1}` : `Page ${(spread[0] ?? 0) + 1}`;
  const toolIll = tool ? data.illustrations[tool.illustrationId] : null;

  return (
    <div ref={rootRef} className={`flex flex-col ${fullscreen ? "h-screen bg-slate-900 p-3" : ""}`}>
      {!fullscreen && <PreviewHeader data={data} readOnly={readOnly} alerts={totalAlerts} />}
      {!fullscreen && !readOnly && data.sketches.count > 0 && <SketchBanner data={data} />}

      {/* Barre d'outils */}
      <div className={`flex flex-wrap items-center gap-2 rounded-t-xl border px-3 py-2 text-sm ${fullscreen ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white"}`}>
        <Button size="sm" variant="secondary" onClick={() => go(-1)} disabled={spreadIndex === 0} aria-label="Page précédente"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-[96px] text-center font-semibold tabular-nums" aria-live="polite">{pageLabel} / {pages.length}</span>
        <Button size="sm" variant="secondary" onClick={() => go(1)} disabled={spreadIndex >= spreads.length - 1} aria-label="Page suivante"><ChevronRight className="h-4 w-4" /></Button>
        <div className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Affichage">
          <button className={`flex items-center gap-1 px-2.5 py-1 ${!double ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`} onClick={() => setLayoutMode("single")} title="Page simple"><FileText className="h-4 w-4" /><span className="hidden md:inline">Simple</span></button>
          <button className={`flex items-center gap-1 px-2.5 py-1 ${double ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`} onClick={() => setLayoutMode("double")} title="Double page"><BookOpen className="h-4 w-4" /><span className="hidden md:inline">Double</span></button>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Zoom">
          {([["fit", "Ajusté"], [1, "100 %"], [2, "200 %"]] as const).map(([z, l]) => (
            <button key={String(z)} className={`px-2.5 py-1 ${zoom === z ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`} onClick={() => setZoom(z)}>{l}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant={controls ? "default" : "secondary"} onClick={() => setControls((c) => !c)} aria-pressed={controls}><ScanEye className="h-4 w-4" /> Contrôles{totalAlerts ? ` (${totalAlerts})` : ""}</Button>
          <Button size="sm" variant={thumbs ? "default" : "secondary"} onClick={() => setThumbs((t) => !t)} aria-pressed={thumbs} title="Miniatures"><LayoutGrid className="h-4 w-4" /></Button>
          <Button size="sm" variant="secondary" onClick={toggleFullscreen} title={fullscreen ? "Quitter le plein écran" : "Plein écran"}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
        </div>
      </div>

      {/* Scène */}
      <div
        ref={stageRef}
        className={`relative overflow-auto border-x ${fullscreen ? "flex-1 border-slate-700 bg-slate-900" : "h-[72vh] min-h-[420px] border-slate-200 bg-gradient-to-b from-slate-200 to-slate-300"}`}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          if (!s || zoom !== "fit") return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
        data-testid="preview-stage"
      >
        <div className="flex min-h-full min-w-full items-center justify-center p-4">
          <div key={`${spread.join("-")}-${double}`} className={`flex ${dir === "next" ? "page-turn-next" : "page-turn-prev"}`} style={{ gap: 2 }}>
            {spread.map((pi) => {
              const p = pages[pi];
              return (
                <div key={p.id} className="preview-sheet relative overflow-hidden bg-white" style={{ width: pageW * scale, height: pageH * scale }} data-preview-page={pi}>
                  <PageRenderer layout={p.layout} theme={theme} mode="preview" scale={scale} pageIndex={pi} pageNumber={p.number} imageVariant={zoom === "fit" ? "screen" : undefined} />
                  {controls && (
                    <ControlsOverlay
                      page={p}
                      pageIndex={pi}
                      widthMm={widthMm}
                      heightMm={heightMm}
                      marginMm={data.marginMm}
                      scale={scale}
                      badges={badgesByPage.get(pi) ?? []}
                      readOnly={readOnly}
                      illustrations={data.illustrations}
                      onImage={(illustrationId, blockId) => openTool(illustrationId, blockId, pi, "recadrer")}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alertes de la double page courante */}
      {controls && (
        <SpreadAlerts
          spread={spread}
          badgesByPage={badgesByPage}
          readOnly={readOnly}
          bookId={data.book.id}
          dark={fullscreen}
          onAction={(pi, b, a) => {
            if (a === "texte") return;
            openTool(b.illustrationId, b.blockId, pi, a);
          }}
        />
      )}

      {/* Miniatures (servent aussi à mesurer les débordements de toutes les pages) */}
      <div ref={thumbsRef} className={`${thumbs ? "" : "h-0 overflow-hidden"} rounded-b-xl border ${fullscreen ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`} aria-label="Miniatures">
        <div className="flex gap-2 overflow-x-auto p-2">
          {pages.map((p, i) => {
            const tScale = 64 / pageW;
            const active = spread.includes(i);
            const worst = (badgesByPage.get(i) ?? []).reduce<PageBadge["severity"] | null>((a, b) => (a === "blocking" || b.severity === "blocking" ? "blocking" : a === "warning" || b.severity === "warning" ? "warning" : a ?? (b.severity === "info" ? "info" : null)), null);
            return (
              <button key={p.id} onClick={() => goToPage(i)} className={`relative shrink-0 rounded-sm text-left ${active ? "ring-2 ring-blue-600 ring-offset-1" : "opacity-80 hover:opacity-100"}`} aria-label={`Aller à la page ${i + 1}`} aria-current={active ? "page" : undefined}>
                <LazyThumb width={64} height={pageH * tScale} root={thumbsRef} onShow={onThumbShown} eager={Math.abs(i - cur) < 6}>
                  <PageRenderer layout={p.layout} theme={theme} mode="preview" scale={tScale} pageIndex={i} pageNumber={p.number} imageVariant="thumb" />
                </LazyThumb>
                <div className={`mt-0.5 text-center text-[10px] ${fullscreen ? "text-slate-300" : "text-slate-500"}`}>{i + 1}</div>
                {worst && worst !== "info" && <span className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${worst === "blocking" ? "bg-red-600" : "bg-amber-400"}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {tool && toolIll && (
        <ImageToolsDialog
          ill={toolIll}
          isSketch={toolIll.isSketch}
          frame={tool.frame}
          open
          initialTab={tool.tab}
          onOpenChange={(o) => { if (!o) { setTool(null); router.refresh(); } }}
        />
      )}
    </div>
  );
}

/** Calque de contrôle : fond perdu, marges de sécurité, cadres d'image (cliquables), alertes. */
function ControlsOverlay({ page, pageIndex, widthMm, heightMm, marginMm, scale, badges, readOnly, illustrations, onImage }: {
  page: BookPreviewData["pages"][number];
  pageIndex: number;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  scale: number;
  badges: PageBadge[];
  readOnly: boolean;
  illustrations: BookPreviewData["illustrations"];
  onImage: (illustrationId: string | undefined, blockId: string) => void;
}) {
  const byBlock = new Map<string, PageBadge[]>();
  for (const b of badges) if (b.blockId) byBlock.set(b.blockId, [...(byBlock.get(b.blockId) ?? []), b]);
  return (
    <div className="pointer-events-none absolute left-0 top-0" style={{ width: `${widthMm}mm`, height: `${heightMm}mm`, transform: `scale(${scale})`, transformOrigin: "top left" }} data-testid={`controls-${pageIndex}`}>
      {/* Fond perdu : bande de 3 mm coupée à l'impression */}
      <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 0 ${BLEED_MM}mm rgba(239,68,68,0.16)` }} />
      {/* Marges de sécurité : le texte et les éléments importants restent à l'intérieur */}
      <div className="absolute border border-dashed border-fuchsia-500/80" style={{ left: `${marginMm}mm`, top: `${marginMm}mm`, width: `${widthMm - 2 * marginMm}mm`, height: `${heightMm - 2 * marginMm}mm` }} />
      {page.layout.blocks.map((b) => {
        if (b.type !== "image") return null;
        const ill = b.illustrationId ? illustrations[b.illustrationId] : undefined;
        const bb = byBlock.get(b.id) ?? [];
        const worst = bb.some((x) => x.severity === "blocking") ? "blocking" : bb.some((x) => x.severity === "warning") ? "warning" : null;
        const color = worst === "blocking" ? "#dc2626" : worst === "warning" ? "#f59e0b" : "#2563eb";
        const clickable = !readOnly && !!ill;
        return (
          <button
            key={b.id}
            type="button"
            disabled={!clickable}
            onClick={() => onImage(b.illustrationId, b.id)}
            className={`absolute ${clickable ? "pointer-events-auto cursor-pointer hover:bg-blue-500/10" : ""}`}
            style={{ left: `${b.x}mm`, top: `${b.y}mm`, width: `${b.w}mm`, height: `${b.h}mm`, outline: `0.5mm solid ${color}`, outlineOffset: "-0.25mm" }}
            title={clickable ? "Recadrer, remplacer ou regénérer cette image" : undefined}
            aria-label={clickable ? `Image ${ill?.label ?? ""} : recadrer` : undefined}
          >
            <span className="absolute bottom-0 left-0 flex items-center gap-1 rounded-tr px-1 py-0.5 text-white" style={{ background: color, fontSize: "2.6mm", lineHeight: 1.2 }}>
              {clickable && <Crop style={{ width: "2.8mm", height: "2.8mm" }} />}
              {ill?.isSketch ? "Esquisse · " : ""}{b.fit === "contain" ? "Ajustée" : "Remplie"}
            </span>
          </button>
        );
      })}
      {badges.filter((b) => b.severity !== "info").length > 0 && (
        <div className="absolute right-[2mm] top-[2mm] flex max-w-[60%] flex-col items-end gap-[1mm]">
          {badges.filter((b) => b.severity !== "info").map((b) => (
            <span key={b.key} className={`rounded px-[1.5mm] py-[0.6mm] font-semibold shadow ${SEVERITY_CLASS[b.severity]}`} style={{ fontSize: "2.8mm" }}>{b.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SpreadAlerts({ spread, badgesByPage, readOnly, bookId, dark, onAction }: { spread: number[]; badgesByPage: Map<number, PageBadge[]>; readOnly: boolean; bookId: string; dark: boolean; onAction: (pageIndex: number, b: PageBadge, a: ImageToolTab | "texte") => void }) {
  const items = spread.flatMap((pi) => (badgesByPage.get(pi) ?? []).map((b) => ({ pi, b })));
  const ACTION_LABEL: Record<ImageToolTab | "texte", { label: string; Icon: typeof Crop }> = {
    recadrer: { label: "Recadrer", Icon: Crop },
    remplacer: { label: "Remplacer par un fichier", Icon: Upload },
    regenerer: { label: "Regénérer cette image", Icon: RefreshCw },
    texte: { label: "Modifier le texte", Icon: Pencil },
  };
  return (
    <div className={`border-x border-t px-3 py-2 text-sm ${dark ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-200 bg-slate-50"}`} data-testid="spread-alerts">
      {items.length === 0 ? (
        <span className={dark ? "text-slate-300" : "text-slate-500"}>Aucune alerte sur {spread.length > 1 ? "ces pages" : "cette page"}. Les cadres bleus sont les images ; pointillés roses : marges de sécurité ; bande rouge : fond perdu (3 mm).</span>
      ) : (
        <ul className="space-y-1.5">
          {items.map(({ pi, b }) => (
            <li key={`${pi}-${b.key}`} className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${SEVERITY_CLASS[b.severity]}`}>{b.severity === "blocking" ? "Bloquant" : b.severity === "warning" ? "À vérifier" : "Info"}</span>
              <span>Page {pi + 1} · {b.label}</span>
              {!readOnly && b.actions.map((a) => {
                const { label, Icon } = ACTION_LABEL[a];
                if (a === "texte") return <Link key={a} href={`/books/${bookId}/editor?page=${pi}`} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 hover:border-blue-400"><Icon className="h-3 w-3" /> {label}</Link>;
                if (!b.illustrationId) return null;
                return <button key={a} onClick={() => onAction(pi, b, a)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 hover:border-blue-400"><Icon className="h-3 w-3" /> {label}</button>;
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreviewHeader({ data, readOnly, alerts }: { data: BookPreviewData; readOnly: boolean; alerts: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [job, setJob] = useState<{ id: string; title: string } | null>(null);
  const [share, setShare] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const b = data.book;
  const state = { sketch: { label: "Esquisses", cls: "bg-amber-100 text-amber-900" }, mixed: { label: "Esquisses et finales", cls: "bg-amber-100 text-amber-900" }, final: { label: "Version finale", cls: "bg-emerald-100 text-emerald-900" }, none: { label: "Sans image", cls: "bg-slate-100 text-slate-700" } }[b.imageState];
  const run = (fn: () => Promise<void>) => start(async () => { setError(null); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } });
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight">{b.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
            {b.universe && <Badge variant="secondary">{b.universe}</Badge>}
            <Badge variant="secondary">{b.typeLabel}</Badge>
            <span>{b.pageCount} pages</span>
            {!readOnly && <span>· coût cumulé {b.costLabel}</span>}
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${state.cls}`}>{state.label}</span>
            {!readOnly && alerts > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700"><TriangleAlert className="h-3 w-3" /> {alerts} alerte(s)</span>}
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending || !!job} onClick={() => run(async () => { const r = await requestExport({ kind: "BOOK_DIGITAL", bookId: b.id }); setJob({ id: r.jobId, title: "Export PDF" }); })}><FileDown className="h-4 w-4" /> Exporter le PDF</Button>
            {data.latestPdf ? (
              <Button size="sm" variant="secondary" asChild><a href={`/api/assets/${data.latestPdf.assetId}?download=1`}><Download className="h-4 w-4" /> Télécharger le PDF</a></Button>
            ) : (
              <Button size="sm" variant="secondary" disabled title="Exportez d'abord le PDF"><Download className="h-4 w-4" /> Télécharger le PDF</Button>
            )}
            <Button size="sm" variant="secondary" disabled={pending || !!job} onClick={() => run(async () => { const r = await publishToShopAction(b.id, { publish: true }); setJob({ id: r.jobId, title: b.shopPublishedAt ? "Mise à jour en boutique" : "Publication en boutique" }); })}><Store className="h-4 w-4" /> {b.shopPublishedAt ? "Mettre à jour en boutique" : "Publier en boutique"}</Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(async () => { const r = await createPreviewLinkAction(b.id); if (!r.ok) throw new Error(r.error); setShare(r.data); setCopied(false); })}><Share2 className="h-4 w-4" /> Partager un lien d'aperçu</Button>
          </div>
        )}
      </div>
      {share && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-sm">
          <input readOnly value={share.url} className="min-w-0 flex-1 rounded border border-blue-200 bg-white px-2 py-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Lien d'aperçu" />
          <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(share.url).then(() => setCopied(true)).catch(() => undefined); }}><Copy className="h-4 w-4" /> {copied ? "Copié" : "Copier"}</Button>
          <span className="text-xs text-blue-900">Lecture seule, valable jusqu'au {new Date(share.expiresAt).toLocaleDateString("fr-FR")}.</span>
        </div>
      )}
      {job && <JobProgress jobId={job.id} compact title={job.title} onDone={() => { setJob(null); router.refresh(); }} />}
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}

function SketchBanner({ data }: { data: BookPreviewData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const s = data.sketches;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" data-testid="sketch-banner">
      <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <b>{s.count} image(s) en esquisse</b> (déjà payé {formatUsd(s.sketchCostUsd)}). Vérifiez les pages, recadrez ou corrigez ce qui doit l'être, puis générez la version finale des esquisses validées : estimation {formatUsd(s.finalCostUsd)}, composition conservée.
      </div>
      {jobId ? (
        <div className="w-full"><JobProgress jobId={jobId} compact title="Versions finales" onDone={() => { setJobId(null); router.refresh(); }} /></div>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Générer la version finale de ${s.count} image(s) ? Coût estimé : ${formatUsd(s.finalCostUsd)}.`)) return;
            start(async () => {
              setError(null);
              const r = await finalizeSketchesAction(data.book.id);
              if (r.ok) setJobId(r.data.jobId);
              else setError(r.error);
            });
          }}
        >Valider les esquisses et générer la version finale</Button>
      )}
      {error && <p className="w-full text-red-700">{error}</p>}
    </div>
  );
}

/**
 * Miniature rendue seulement à l'approche de la zone visible (IntersectionObserver) :
 * un livre de 130 pages n'affiche que la vingtaine de miniatures utiles, avec des vignettes légères.
 */
function LazyThumb({ width, height, root, onShow, eager, children }: { width: number; height: number; root: React.RefObject<HTMLDivElement | null>; onShow: () => void; eager?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(Boolean(eager));
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(true);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    }, { root: root.current?.firstElementChild ?? null, rootMargin: "0px 600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible, root]);
  useEffect(() => { if (visible) onShow(); }, [visible, onShow]);
  return (
    <div ref={ref} className="overflow-hidden bg-white shadow-sm" style={{ width, height }} data-thumb-visible={visible ? "1" : "0"}>
      {visible ? children : null}
    </div>
  );
}
