"use client";
import { useRef, useState, useTransition } from "react";
import { Crosshair, Maximize, Minimize, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { framingStyle, effectiveFit, effectiveDpi, visibleWindow, RATIO_VALUES, DPI_WARN, DPI_BLOCK, type Fit } from "@/lib/images/framing";
import { resetFramingAction, saveFramingAction } from "@/app/actions/images";

export interface FramingTarget {
  id: string;
  label: string;
  src: string;
  width: number | null;
  height: number | null;
  focalX: number;
  focalY: number;
  zoom: number;
  fit: "cover" | "contain" | null;
  targetRatio: string | null;
}

/**
 * Éditeur de cadrage : on déplace le point d'intérêt sur l'image entière, on zoome, on choisit
 * « remplir » ou « ajuster ». L'aperçu à droite est rendu comme la page (et le PDF).
 * Enregistrer met à jour les pages sans aucun appel IA.
 */
export function FramingEditor({ ill, frame, onSaved }: { ill: FramingTarget; frame?: { w: number; h: number }; onSaved?: () => void }) {
  const [fx, setFx] = useState(ill.focalX);
  const [fy, setFy] = useState(ill.focalY);
  const [zoom, setZoom] = useState(ill.zoom);
  const [fitChoice, setFitChoice] = useState<"cover" | "contain" | null>(ill.fit);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const ratio = ill.targetRatio === "portrait" || ill.targetRatio === "landscape" || ill.targetRatio === "square" ? RATIO_VALUES[ill.targetRatio] : 1;
  const fw = frame?.w ?? 100 * ratio;
  const fh = frame?.h ?? 100;
  const imgW = ill.width ?? 1024;
  const imgH = ill.height ?? 1024;
  const fit: Fit = effectiveFit({ fit: fitChoice, imgW, imgH, frameW: fw, frameH: fh });
  const win = visibleWindow({ imgW, imgH, frameW: fw, frameH: fh, focalX: fx, focalY: fy, zoom });
  const dpi = frame ? effectiveDpi({ imgW, imgH, frameWmm: fw, frameHmm: fh, fit, zoom }) : null;
  const style = framingStyle({ fit, focalX: fx, focalY: fy, zoom });

  // Le point d'intérêt suit le pointeur sur l'image entière
  const setFromPointer = (e: React.PointerEvent) => {
    const el = boxRef.current?.querySelector("img");
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFx(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
    setFy(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };

  const previewW = fw >= fh ? 260 : Math.round(260 * (fw / fh));
  const previewH = fw >= fh ? Math.round(260 * (fh / fw)) : 260;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">Image entière — faites glisser pour placer le point d'intérêt</div>
          <div
            ref={boxRef}
            className="relative inline-block max-w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            onPointerDown={(e) => { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setFromPointer(e); }}
            onPointerMove={(e) => dragging.current && setFromPointer(e)}
            onPointerUp={() => (dragging.current = false)}
            data-testid="framing-source"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ill.src} alt={ill.label} draggable={false} className="block max-h-[46vh] w-auto max-w-full" />
            {fit === "cover" && (
              <>
                {/* Zone visible dans le cadre ; le reste est assombri */}
                <div className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" style={{ left: `${win.x0 * 100}%`, top: `${win.y0 * 100}%`, width: `${win.vw * 100}%`, height: `${win.vh * 100}%` }} />
                <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${fx * 100}%`, top: `${fy * 100}%` }}>
                  <Crosshair className="h-6 w-6 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                </div>
              </>
            )}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">Rendu dans la page</div>
          <div className="relative overflow-hidden rounded-md border border-slate-300 bg-slate-50" style={{ width: previewW, height: previewH, background: fit === "contain" ? "#f1f5f9" : undefined }} data-testid="framing-preview">
            <div className="absolute inset-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ill.src} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block", ...style }} />
            </div>
          </div>
          {dpi !== null && (
            <div className={`mt-2 text-xs ${dpi < DPI_BLOCK ? "text-red-700" : dpi < DPI_WARN ? "text-amber-700" : "text-emerald-700"}`}>
              Résolution à l'impression : {dpi} ppp {dpi < DPI_BLOCK ? "(insuffisante)" : dpi < DPI_WARN ? "(limite)" : "(bonne)"}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-sm" role="group" aria-label="Ajustement">
          <button type="button" className={`flex items-center gap-1 px-3 py-1.5 ${fitChoice === "cover" ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setFitChoice("cover")}><Maximize className="h-3.5 w-3.5" /> Remplir</button>
          <button type="button" className={`flex items-center gap-1 px-3 py-1.5 ${fitChoice === "contain" ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setFitChoice("contain")}><Minimize className="h-3.5 w-3.5" /> Ajuster</button>
          <button type="button" className={`px-3 py-1.5 ${fitChoice === null ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setFitChoice(null)}>Auto</button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Zoom
          <input type="range" min={1} max={3} step={0.05} value={zoom} disabled={fit === "contain"} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
          <span className="w-10 tabular-nums text-slate-600">{Math.round(zoom * 100)} %</span>
        </label>
      </div>
      <p className="text-xs text-slate-500">{fit === "contain" ? "Ajuster : l'image entière est visible, le fond reprend ses couleurs (aucune bande noire)." : "Remplir : l'image couvre tout le cadre ; le point d'intérêt reste visible."} Le cadrage ne coûte rien et ne relance aucune génération.</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={pending}
          onClick={() => start(async () => {
            const r = await saveFramingAction(ill.id, { focalX: fx, focalY: fy, zoom, fit: fitChoice });
            setMsg(r.ok ? "Cadrage enregistré : pages mises à jour." : r.error);
            if (r.ok) onSaved?.();
          })}
        >Enregistrer le cadrage</Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => start(async () => {
            const r = await resetFramingAction(ill.id);
            if (r.ok) {
              setFx(r.data.focalX);
              setFy(r.data.focalY);
              setZoom(r.data.zoom);
              setFitChoice(r.data.fit);
              setMsg("Recadrage automatique appliqué (zone d'intérêt détectée).");
              onSaved?.();
            } else setMsg(r.error);
          })}
        ><Wand2 className="h-4 w-4" /> Recadrage automatique</Button>
        {msg && <span className="text-sm text-slate-600" role="status">{msg}</span>}
      </div>
    </div>
  );
}
