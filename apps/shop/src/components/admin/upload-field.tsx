"use client";
import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadedPublic { url: string; key: string; width?: number; height?: number; name: string; size: number; mime: string }
export interface UploadedPrivate { key: string; size: number; mime: string; name: string }

const DIRECT_MAX = 4 * 1024 * 1024;
const CHUNK = 3.5 * 1024 * 1024;

/** Zone de dépôt + envoi via /api/admin/upload avec barre de progression (XHR). */
export function UploadField({ scope, productId, accept, multiple = false, label = "Déposer un fichier ou cliquer", onUploaded, className }: { scope: "public" | "private"; productId?: string; accept?: string; multiple?: boolean; label?: string; onUploaded: (file: UploadedPublic | UploadedPrivate) => void | boolean | Promise<void>; className?: string }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Envoi XHR avec progression ; renvoie le JSON ou lève une erreur lisible. */
  function send(url: string, body: FormData | string, onProgress: (loaded: number) => void): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      if (typeof body === "string") xhr.setRequestHeader("Content-Type", "application/json");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
      xhr.onload = () => {
        let json: Record<string, unknown> | null = null;
        try { json = JSON.parse(xhr.responseText); } catch { /* réponse non JSON */ }
        if (xhr.status === 413) return reject(new Error("Fichier trop volumineux pour un envoi direct"));
        if (!json) return reject(new Error(`Réponse invalide du serveur (code ${xhr.status})`));
        if (xhr.status >= 400) return reject(new Error(typeof json.error === "string" ? json.error : "Échec de l'envoi"));
        resolve(json);
      };
      xhr.onerror = () => reject(new Error("Erreur réseau"));
      xhr.send(body);
    });
  }

  async function uploadOne(file: File) {
    const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    if (file.size <= DIRECT_MAX) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("scope", scope);
      if (productId) fd.append("productId", productId);
      const json = await send("/api/admin/upload", fd, (l) => setProgress(Math.round((l / file.size) * 100)));
      return { ...json, name: file.name, size: file.size, mime };
    }
    // Gros fichier : envoi en morceaux de 3,5 Mo (limite de 4,5 Mo par requête sur Vercel), puis assemblage
    const uploadId = crypto.randomUUID().replace(/-/g, "");
    const parts = Math.ceil(file.size / CHUNK);
    for (let i = 0; i < parts; i++) {
      const fd = new FormData();
      fd.append("uploadId", uploadId);
      fd.append("index", String(i));
      fd.append("chunk", file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK)));
      let attempt = 0;
      for (;;) {
        try {
          await send("/api/admin/upload/chunk", fd, (l) => setProgress(Math.min(99, Math.round(((i * CHUNK + l) / file.size) * 100))));
          break;
        } catch (e) {
          if (++attempt >= 3) throw e;
        }
      }
    }
    setProgress(99);
    const json = await send("/api/admin/upload", JSON.stringify({ uploadId, parts, name: file.name, mime, scope, productId }), () => undefined);
    return { ...json, name: file.name, size: file.size, mime };
  }

  async function upload(files: FileList | File[]) {
    setError(null);
    for (const file of Array.from(files)) {
      try {
        setProgress(0);
        const up = await uploadOne(file);
        setProgress(null);
        await onUploaded(up as unknown as UploadedPublic | UploadedPrivate);
      } catch (e) {
        setProgress(null);
        setError(`${file.name} : ${e instanceof Error ? e.message : "échec de l'envoi"}`);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={className}>
      <div
        role="button" tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
        className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors", drag ? "border-coral bg-coral-light" : "border-line bg-[#FBFAF7] hover:border-ink/30")}
      >
        <UploadCloud className="size-6 text-ink-muted" />
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-ink-muted">{scope === "private" ? "Stockage privé — jamais accessible publiquement" : "Images publiques (JPG, PNG, WebP, SVG)"} · 100 Mo max</span>
        <input ref={inputRef} type="file" className="sr-only" accept={accept} multiple={multiple} onChange={(e) => e.target.files && void upload(e.target.files)} />
      </div>
      {progress !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10" aria-label="Progression"><div className="h-full bg-coral transition-all" style={{ width: `${progress}%` }} /></div>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-600" role="alert">{error}</p>}
    </div>
  );
}
