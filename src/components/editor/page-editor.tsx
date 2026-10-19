"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Undo2, Redo2, Save, Plus, Copy, Trash2, ChevronUp, ChevronDown, Lock, Unlock, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { PageRenderer } from "@/components/page-renderer";
import { savePages, newPageFromTemplate } from "@/app/actions/pages";
import { saveBookTheme } from "@/app/actions/books";
import { BUILTIN_TEMPLATES } from "@/lib/layout/themes";
import { numberPages } from "@/lib/layout/pageNumbers";
import { MM_TO_PX } from "@/lib/layout/formats";
import { PAGE_TEMPLATES, type Block, type BookTheme, type PageLayout } from "@/lib/schemas/layout";
import { newId, cn } from "@/lib/utils";
import { Inspector } from "./inspector";

export interface EditorPage { id: string; templateKey: string; locked: boolean; activityId: string | null; layout: PageLayout }

export function PageEditor({ bookId, bookTitle, theme: initialTheme, initialPages, initialIndex }: { bookId: string; bookTitle: string; theme: BookTheme; initialPages: EditorPage[]; initialIndex: number }) {
  const [history, setHistory] = useState<EditorPage[][]>([initialPages]);
  const [cursor, setCursor] = useState(0);
  const pages = history[cursor];
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, initialPages.length - 1)));
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.9);
  const [theme, setTheme] = useState(initialTheme);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const page = pages[index];
  const numbers = useMemo(() => numberPages(pages), [pages]);

  /** Enregistre un nouvel état dans l'historique (annuler / rétablir). */
  const commit = useCallback((next: EditorPage[]) => {
    setHistory((h) => [...h.slice(0, cursor + 1), next].slice(-100));
    setCursor((c) => Math.min(c + 1, 99));
    setDirty(true);
  }, [cursor]);
  const undo = () => { if (cursor > 0) { setCursor(cursor - 1); setDirty(true); } };
  const redo = () => { if (cursor < history.length - 1) { setCursor(cursor + 1); setDirty(true); } };

  const updatePage = useCallback((i: number, fn: (p: EditorPage) => EditorPage) => {
    const next = pages.map((p, j) => (j === i ? { ...fn(p), locked: true } : p));
    commit(next);
  }, [pages, commit]);
  const updateBlock = useCallback((blockId: string, patch: Partial<Block>) => {
    updatePage(index, (p) => ({ ...p, layout: { ...p.layout, blocks: p.layout.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)) } }));
  }, [index, updatePage]);

  // --- Déplacement / redimensionnement à la souris ------------------------
  const drag = useRef<{ id: string; handle: "move" | "resize"; startX: number; startY: number; x: number; y: number; w: number; h: number } | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const onBlockPointerDown = (e: React.PointerEvent, block: Block, handle: "move" | "resize") => {
    if (!block.editable && handle === "move") return;
    drag.current = { id: block.id, handle, startX: e.clientX, startY: e.clientY, x: block.x, y: block.y, w: block.w, h: block.h };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  useEffect(() => {
    const pxPerMm = MM_TO_PX * zoom;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / pxPerMm;
      const dy = (e.clientY - d.startY) / pxPerMm;
      const el = liveRef.current?.querySelector<HTMLElement>(`[data-block-id="${d.id}"]`);
      if (!el) return;
      if (d.handle === "move") { el.style.left = `${d.x + dx}mm`; el.style.top = `${d.y + dy}mm`; } else { el.style.width = `${Math.max(5, d.w + dx)}mm`; el.style.height = `${Math.max(5, d.h + dy)}mm`; }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      const dx = (e.clientX - d.startX) / pxPerMm;
      const dy = (e.clientY - d.startY) / pxPerMm;
      if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return;
      const r = (v: number) => Math.round(v * 2) / 2;
      if (d.handle === "move") updateBlock(d.id, { x: r(d.x + dx), y: r(d.y + dy) });
      else updateBlock(d.id, { w: r(Math.max(5, d.w + dx)), h: r(Math.max(5, d.h + dy)) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [zoom, updateBlock]);

  // --- Raccourcis clavier ------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const editing = (document.activeElement as HTMLElement | null)?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName ?? "");
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
      else if (e.key === "Delete" && selected && !editing) { updatePage(index, (p) => ({ ...p, layout: { ...p.layout, blocks: p.layout.blocks.filter((b) => b.id !== selected) } })); setSelected(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const save = () => start(async () => {
    try {
      await savePages(bookId, pages);
      setDirty(false);
      setMessage("Enregistré");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage(`Erreur : ${err instanceof Error ? err.message : err}`);
    }
  });

  // --- Actions de page -----------------------------------------------------
  const addPage = (templateKey: string) => start(async () => {
    const p = await newPageFromTemplate(bookId, templateKey);
    const np: EditorPage = { id: newId("page"), templateKey: p.templateKey, locked: true, activityId: null, layout: p.layout as PageLayout };
    const next = [...pages.slice(0, index + 1), np, ...pages.slice(index + 1)];
    commit(next);
    setIndex(index + 1);
  });
  const duplicatePage = () => {
    const copy: EditorPage = { ...page, id: newId("page"), locked: true, layout: { ...page.layout, blocks: page.layout.blocks.map((b) => ({ ...b, id: newId("b") })) } };
    commit([...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)]);
    setIndex(index + 1);
  };
  const deletePage = () => {
    if (pages.length <= 1 || !confirm("Supprimer cette page ?")) return;
    commit(pages.filter((_, i) => i !== index));
    setIndex(Math.max(0, index - 1));
  };
  const movePage = (dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[index], next[j]] = [next[j], next[index]];
    commit(next);
    setIndex(j);
  };
  const toggleLock = () => commit(pages.map((p, i) => (i === index ? { ...p, locked: !p.locked } : p)));
  const addBlock = (type: "text" | "image" | "shape") => {
    const m = theme.marginMm;
    const b: Block =
      type === "text" ? { id: newId("t"), type: "text", role: "body", text: "Nouveau texte", x: m, y: m + 20, w: 80, h: 20, style: { fontSizePt: theme.baseFontPt }, editable: true }
      : type === "image" ? { id: newId("i"), type: "image", role: "decoration", alt: "", caption: "", isDemo: false, fit: "contain", x: m, y: m + 20, w: 60, h: 60, style: { radius: 3 }, editable: true }
      : { id: newId("s"), type: "shape", shape: "rect", color: theme.colorPanel, x: m, y: m + 20, w: 60, h: 30, style: { radius: 3 }, editable: true };
    updatePage(index, (p) => ({ ...p, layout: { ...p.layout, blocks: [...p.layout.blocks, b] } }));
    setSelected(b.id);
  };
  const applyTheme = (key: string) => {
    const t = BUILTIN_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setTheme(t.theme);
    start(() => saveBookTheme(bookId, t.theme));
  };

  const selectedBlock = page?.layout.blocks.find((b) => b.id === selected) ?? null;

  if (!page) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Ce livre n'a pas encore de pages. Assemblez-les depuis l'onglet « Pages » du livre.</p>
        <Button asChild variant="secondary" className="mt-3"><Link href={`/books/${bookId}?tab=pages`}>Retour au livre</Link></Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Barre d'outils */}
      <div className="h-12 shrink-0 border-b bg-white flex items-center gap-2 px-3">
        <Button asChild size="sm" variant="ghost"><Link href={`/books/${bookId}?tab=pages`}><ArrowLeft className="h-4 w-4" /> {bookTitle}</Link></Button>
        <div className="h-6 w-px bg-slate-200" />
        <Button size="sm" variant="ghost" onClick={undo} disabled={cursor === 0} title="Annuler (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={redo} disabled={cursor >= history.length - 1} title="Rétablir (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
        <div className="h-6 w-px bg-slate-200" />
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
        <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
        <div className="h-6 w-px bg-slate-200" />
        <span className="text-xs text-slate-500">Page {index + 1} / {pages.length}</span>
        <Select className="h-8 w-40 text-xs" value={theme.templateKey} onChange={(e) => applyTheme(e.target.value)}>
          {BUILTIN_TEMPLATES.map((t) => <option key={t.key} value={t.key}>Thème : {t.name}</option>)}
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {message && <span className="text-xs text-slate-600">{message}</span>}
          {dirty && !message && <span className="text-xs text-amber-700">Modifications non enregistrées</span>}
          <Button size="sm" onClick={save} disabled={pending || !dirty}><Save className="h-4 w-4" /> Enregistrer</Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Vignettes */}
        <aside className="w-44 shrink-0 border-r bg-white overflow-y-auto p-2 space-y-2">
          {pages.map((p, i) => {
            const s = 140 / (p.layout.widthMm * MM_TO_PX);
            return (
              <button key={p.id} onClick={() => { setIndex(i); setSelected(null); }} className={cn("block w-full text-left rounded-md border p-1 cursor-pointer", i === index ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300")}>
                <div className="overflow-hidden bg-white" style={{ width: 140, height: Math.round(140 * (p.layout.heightMm / p.layout.widthMm)) }}>
                  <PageRenderer layout={p.layout} theme={theme} mode="preview" scale={s} pageNumber={numbers[i]} />
                </div>
                <div className="text-[10px] mt-1 text-slate-600 truncate">{i + 1}. {PAGE_TEMPLATES.find((t) => t.key === p.templateKey)?.name ?? p.templateKey}{p.locked ? " 🔒" : ""}</div>
              </button>
            );
          })}
        </aside>

        {/* Canevas */}
        <div className="flex-1 overflow-auto p-8" onPointerDown={() => setSelected(null)}>
          <div ref={liveRef} className="mx-auto shadow-xl" style={{ width: page.layout.widthMm * MM_TO_PX * zoom, height: page.layout.heightMm * MM_TO_PX * zoom }} onPointerDown={(e) => e.stopPropagation()}>
            <PageRenderer
              key={`${page.id}-${cursor}`}
              layout={page.layout}
              theme={theme}
              mode="edit"
              scale={zoom}
              pageNumber={numbers[index]}
              selectedId={selected}
              onSelect={setSelected}
              onBlockPointerDown={onBlockPointerDown}
              onTextCommit={(id, text) => {
                const b = page.layout.blocks.find((x) => x.id === id);
                if (b && b.type === "text" && b.text !== text) updateBlock(id, { text } as Partial<Block>);
              }}
            />
          </div>
        </div>

        {/* Inspecteur */}
        <aside className="w-72 shrink-0 border-l bg-white overflow-y-auto p-3 space-y-4 text-sm">
          <section className="space-y-2">
            <div className="font-bold text-xs uppercase text-slate-500">Page</div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="secondary" onClick={duplicatePage} title="Dupliquer"><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="secondary" onClick={deletePage} title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="secondary" onClick={() => movePage(-1)} title="Monter"><ChevronUp className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="secondary" onClick={() => movePage(1)} title="Descendre"><ChevronDown className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="secondary" onClick={toggleLock} title={page.locked ? "Déverrouiller : la page sera régénérée automatiquement" : "Verrouiller : conserver lors des régénérations"}>{page.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</Button>
            </div>
            <Select className="h-8 text-xs" value="" onChange={(e) => { if (e.target.value) addPage(e.target.value); }}>
              <option value="">+ Ajouter une page après celle-ci…</option>
              <option value="blank">Page vierge</option>
              <option value="intro">Page de présentation</option>
              <option value="diploma">Diplôme</option>
              <option value="conclusion">Page de conclusion</option>
            </Select>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => addBlock("text")}><Plus className="h-3.5 w-3.5" /> Texte</Button>
              <Button size="sm" variant="ghost" onClick={() => addBlock("image")}><Plus className="h-3.5 w-3.5" /> Image</Button>
              <Button size="sm" variant="ghost" onClick={() => addBlock("shape")}><Plus className="h-3.5 w-3.5" /> Forme</Button>
            </div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={page.layout.showPageNumber} onChange={(e) => updatePage(index, (p) => ({ ...p, layout: { ...p.layout, showPageNumber: e.target.checked } }))} /> Numéro de page</label>
            <p className="text-[11px] text-slate-500">{page.locked ? "Page modifiée manuellement : conservée lors des régénérations automatiques." : "Page générée : elle sera remplacée si vous relancez l'assemblage."}</p>
          </section>
          <Inspector block={selectedBlock} theme={theme} onChange={(patch) => selectedBlock && updateBlock(selectedBlock.id, patch)} onDelete={() => { if (selectedBlock) { updatePage(index, (p) => ({ ...p, layout: { ...p.layout, blocks: p.layout.blocks.filter((b) => b.id !== selectedBlock.id) } })); setSelected(null); } }} onOrder={(dir) => { if (!selectedBlock) return; updatePage(index, (p) => { const bs = [...p.layout.blocks]; const i = bs.findIndex((b) => b.id === selectedBlock.id); const j = i + dir; if (j < 0 || j >= bs.length) return p; [bs[i], bs[j]] = [bs[j], bs[i]]; return { ...p, layout: { ...p.layout, blocks: bs } }; }); }} />
        </aside>
      </div>
    </div>
  );
}
