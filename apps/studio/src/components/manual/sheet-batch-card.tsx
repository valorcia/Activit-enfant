"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unzipSync } from "fflate";
import { Check, Copy, ExternalLink, Grid2x2, Grid3x3, Layers, RefreshCw, Scissors, Square, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processSheetsAction, recutSheetAction, removeSheetAction, reorderSheetsAction, setSheetGridAction, swapCellsAction, toggleRejectCellAction, uploadSheetAction, validateSheetsAction } from "@/app/actions/sheets";

export interface SheetBatchView {
  id: string;
  title: string;
  prompt: string;
  error: string | null;
  bookId: string | null;
  ageRange: string;
  grid: 1 | 4 | 9;
  stage: "pending" | "processing" | "review" | "done";
  drawings: number;
  sheets: number;
  processError: string | null;
  processStep: string | null;
  uploads: Array<{ assetId: string; name: string; url: string; fallback?: boolean; width?: number; height?: number; cutsX?: number[]; cutsY?: number[] }>;
  cells: Array<{ index: number; sheet: number; url: string; vector: boolean; slot: string | null; numero: number | null; titre: string | null; rejected: boolean }>;
}

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

/** Fichiers déposés → images (les ZIP sont décompressés ici, dans le navigateur). */
async function expandFiles(list: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of list) {
    if (/\.zip$/i.test(f.name) || f.type === "application/zip" || f.type === "application/x-zip-compressed") {
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));
      for (const [name, data] of Object.entries(entries)) {
        if (!IMAGE_EXT.test(name) || name.startsWith("__MACOSX")) continue;
        const ext = name.split(".").pop()!.toLowerCase();
        out.push(new File([data as BlobPart], name.split("/").pop()!, { type: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg", lastModified: f.lastModified }));
      }
    } else if (/^image\/(png|jpeg|webp)$/.test(f.type) || IMAGE_EXT.test(f.name)) out.push(f);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" }) || a.lastModified - b.lastModified);
}

export function SheetBatchCard({ v }: { v: SheetBatchView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [recut, setRecut] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const side = v.grid === 9 ? 3 : v.grid === 4 ? 2 : 1;

  // Découpage en cours dans le worker : actualisation régulière
  useEffect(() => {
    if (v.stage !== "processing") return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [v.stage, router]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Erreur");
      router.refresh();
    });

  const upload = async (files: File[]) => {
    setError(null);
    const images = await expandFiles(files);
    if (!images.length) return setError("Aucune image PNG, JPG ou WebP trouvée (ZIP accepté).");
    for (let i = 0; i < images.length; i++) {
      setProgress(`Dépôt ${i + 1}/${images.length} : ${images[i].name}`);
      const fd = new FormData();
      fd.set("requestId", v.id);
      fd.set("file", images[i]);
      fd.set("name", images[i].name);
      fd.set("lastModified", String(images[i].lastModified));
      const r = await uploadSheetAction(fd);
      if (!r.ok) {
        setError(r.error);
        break;
      }
    }
    setProgress(null);
    router.refresh();
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const ids = v.uploads.map((u) => u.assetId);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    run(() => reorderSheetsAction(v.id, ids));
  };

  const accepted = v.cells.filter((c) => c.slot && !c.rejected).length;
  const rejected = v.cells.filter((c) => c.rejected).length;

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-bold"><Layers className="h-4 w-4 text-violet-700" /> {v.title}</div>
          <p className="mt-1 text-sm text-slate-500">{v.drawings} dessins · {v.sheets} image(s) à produire dans ChatGPT ({v.grid === 1 ? "1 dessin par image" : `${v.grid} dessins par planche`}).</p>
        </div>
        {v.stage === "pending" && !v.uploads.length && (
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 text-xs">
            {([[1, "1", Square], [4, "2×2", Grid2x2], [9, "3×3", Grid3x3]] as const).map(([g, label, Icon]) => (
              <button key={g} type="button" disabled={pending} onClick={() => run(() => setSheetGridAction(v.id, g))} className={`flex items-center gap-1 rounded-md px-2 py-1 ${v.grid === g ? "bg-violet-600 text-white" : "hover:bg-slate-100"}`} title={g === 9 ? "Moins de planches mais dessins plus petits (déconseillé pour les 3–5 ans)" : undefined}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {v.grid === 9 && /^3-|^4-/.test(v.ageRange) && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">3×3 : dessins plus petits, déconseillé pour les 3–5 ans (traits trop fins une fois agrandis). Préférez 2×2.</p>}

      {(v.stage === "pending" || v.stage === "processing") && (
        <>
          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50" open={!v.uploads.length}>
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">1. Prompt maître à coller dans ChatGPT</summary>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3 pb-3 text-xs text-slate-700">{v.prompt}</pre>
          </details>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={async () => { try { await navigator.clipboard.writeText(v.prompt); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* presse-papiers indisponible */ } }}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copié !" : "Copier le prompt"}</Button>
            <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir ChatGPT</a>
          </div>
          <p className="mt-2 text-xs text-slate-500">ChatGPT s&apos;arrête régulièrement (limites par message et par période selon l&apos;abonnement) : écrivez simplement « continue » pour qu&apos;il reprenne à la planche suivante. Pour aucune intervention, passez les images de ce livre par l&apos;API (plan du livre → « Images : API OpenAI »).</p>

          <div
            className="mt-4 rounded-lg border-2 border-dashed border-slate-300 p-5 text-center text-sm"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragFrom === null) void upload(Array.from(e.dataTransfer.files)); }}
          >
            <p className="text-slate-600">2. Déposez ici toutes les planches téléchargées (plusieurs fichiers d&apos;un coup, ou un ZIP), ou</p>
            <Button size="sm" variant="secondary" className="mt-2" disabled={pending || !!progress} onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Choisir les fichiers</Button>
            <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,.zip,application/zip" className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void upload(f); }} />
            {progress && <p className="mt-2 text-xs text-violet-700">{progress}</p>}
            <p className="mt-2 text-xs text-slate-400">Ordre : nom de fichier (les téléchargements ChatGPT contiennent la date et l&apos;heure), puis date ; glissez une planche pour la déplacer.</p>
          </div>

          {v.uploads.length > 0 && (
            <>
              <div className="mt-3 text-sm font-semibold">{v.uploads.length} / {v.sheets} planche(s) déposée(s)</div>
              <ol className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {v.uploads.map((u, i) => (
                  <li key={u.assetId} draggable onDragStart={() => setDragFrom(i)} onDragEnd={() => setDragFrom(null)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragFrom !== null) reorder(dragFrom, i); setDragFrom(null); }} className="group relative cursor-move rounded border border-slate-200 bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${u.url}?v=thumb`} alt={u.name} loading="lazy" className="aspect-[2/3] w-full object-contain" />
                    <div className="mt-0.5 truncate text-center text-[10px] text-slate-500">{i + 1}. {u.name}</div>
                    <button type="button" className="absolute right-0.5 top-0.5 hidden rounded bg-white/90 p-0.5 text-red-600 group-hover:block" onClick={() => run(() => removeSheetAction(v.id, u.assetId))} aria-label="Retirer"><X className="h-3 w-3" /></button>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex items-center gap-3">
                <Button disabled={pending || v.stage === "processing"} onClick={() => run(() => processSheetsAction(v.id))}><Scissors className="h-4 w-4" /> {v.stage === "processing" ? "Découpage en cours…" : "3. Découper les planches"}</Button>
                {v.stage === "processing" && <span className="text-xs text-slate-500">{v.processStep ?? "Le worker découpe, vectorise et convertit en noir et blanc…"}</span>}
              </div>
            </>
          )}
        </>
      )}

      {v.stage === "review" && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">4. Vérifiez : cliquez deux dessins pour les <b>permuter</b>, rejetez un dessin raté (il repassera en demande individuelle, ou par l&apos;API si une clé est configurée), ou réglez la découpe d&apos;une planche.</p>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => processSheetsAction(v.id))}><RefreshCw className="h-3.5 w-3.5" /> Redécouper tout</Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {v.cells.map((c) => (
              <figure key={c.index} className={`rounded-lg border bg-white p-1.5 ${c.rejected ? "border-red-300 opacity-50" : selected === c.index ? "border-violet-600 ring-2 ring-violet-300" : "border-slate-200"}`}>
                <button type="button" className="block w-full" onClick={() => { if (selected === null) setSelected(c.index); else { const a = selected; setSelected(null); if (a !== c.index) run(() => swapCellsAction(v.id, a, c.index)); } }} title="Cliquer pour permuter avec un autre dessin">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt={c.titre ?? ""} loading="lazy" className="aspect-[3/4] w-full bg-white object-contain" />
                </button>
                <figcaption className="mt-1 text-[11px] leading-tight text-slate-700">{c.numero ? <b>{c.numero}</b> : "—"} {c.titre ?? "(case en trop)"}</figcaption>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Planche {c.sheet + 1}{c.vector ? " · vectoriel" : ""}</span>
                  <span className="flex gap-1">
                    <button type="button" className="hover:text-violet-700" onClick={() => setRecut(c.sheet)} title="Planche mal découpée"><Scissors className="h-3 w-3" /></button>
                    <button type="button" className="hover:text-red-700" onClick={() => run(() => toggleRejectCellAction(v.id, c.index))} title={c.rejected ? "Rétablir" : "Rejeter ce dessin"}>{c.rejected ? <RefreshCw className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}</button>
                  </span>
                </div>
              </figure>
            ))}
          </div>
          {recut !== null && v.uploads[recut] && <RecutEditor key={recut} sheet={recut} side={side} upload={v.uploads[recut]} busy={pending} onCancel={() => setRecut(null)} onApply={(fx, fy) => { setRecut(null); run(() => recutSheetAction(v.id, recut, fx, fy)); }} />}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={pending} onClick={() => run(() => validateSheetsAction(v.id))}><Check className="h-4 w-4" /> Valider {accepted} dessin(s) et reprendre la production</Button>
            <span className="text-xs text-slate-500">{rejected ? `${rejected} rejeté(s) · ` : ""}{Math.max(0, v.drawings - v.cells.filter((c) => c.slot).length)} manquant(s)</span>
          </div>
        </div>
      )}

      {(error || v.processError || v.error) && <p className="mt-3 text-sm text-red-700">{error ?? v.processError ?? v.error}</p>}
    </div>
  );
}

/** Réglage manuel des lignes de découpe d'une planche (curseurs en % de la largeur / hauteur). */
function RecutEditor({ sheet, side, upload, busy, onCancel, onApply }: { sheet: number; side: number; upload: SheetBatchView["uploads"][number]; busy: boolean; onCancel: () => void; onApply: (fx: number[], fy: number[]) => void }) {
  const W = upload.width || 1;
  const H = upload.height || 1;
  const init = (cuts: number[] | undefined, L: number) => (cuts?.length === side - 1 ? cuts.map((c) => c / L) : Array.from({ length: side - 1 }, (_, k) => (k + 1) / side));
  const [fx, setFx] = useState(() => init(upload.cutsX, W));
  const [fy, setFy] = useState(() => init(upload.cutsY, H));
  return (
    <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-3">
      <div className="mb-2 text-sm font-semibold">Découpe de la planche {sheet + 1}{upload.fallback ? " (gouttières non détectées : découpe régulière)" : ""}</div>
      <div className="flex flex-wrap gap-4">
        <div className="relative w-56 shrink-0 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${upload.url}?v=screen`} alt="" className="w-full" />
          {fx.map((f, i) => <div key={`x${i}`} className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: `${f * 100}%` }} />)}
          {fy.map((f, i) => <div key={`y${i}`} className="absolute inset-x-0 h-0.5 bg-red-500" style={{ top: `${f * 100}%` }} />)}
        </div>
        <div className="space-y-2 text-xs">
          {fx.map((f, i) => <label key={`lx${i}`} className="block">Coupe verticale {i + 1} : {Math.round(f * 100)} %<input type="range" min={5} max={95} value={Math.round(f * 100)} onChange={(e) => setFx(fx.map((x, j) => (j === i ? Number(e.target.value) / 100 : x)))} className="block w-48" /></label>)}
          {fy.map((f, i) => <label key={`ly${i}`} className="block">Coupe horizontale {i + 1} : {Math.round(f * 100)} %<input type="range" min={5} max={95} value={Math.round(f * 100)} onChange={(e) => setFy(fy.map((y, j) => (j === i ? Number(e.target.value) / 100 : y)))} className="block w-48" /></label>)}
          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={busy} onClick={() => onApply(fx, fy)}><Scissors className="h-3.5 w-3.5" /> Redécouper</Button>
            <Button size="sm" variant="secondary" onClick={onCancel}>Annuler</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
