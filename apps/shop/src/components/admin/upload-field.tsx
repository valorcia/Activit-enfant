"use client";
import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadedPublic { url: string; key: string; width?: number; height?: number; name: string; size: number; mime: string }
export interface UploadedPrivate { key: string; size: number; mime: string; name: string }

/** Zone de dépôt + envoi via /api/admin/upload avec barre de progression (XHR). */
export function UploadField({ scope, productId, accept, multiple = false, label = "Déposer un fichier ou cliquer", onUploaded, className }: { scope: "public" | "private"; productId?: string; accept?: string; multiple?: boolean; label?: string; onUploaded: (file: UploadedPublic | UploadedPrivate) => void | boolean | Promise<void>; className?: string }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    setError(null);
    for (const file of Array.from(files)) {
      await new Promise<void>((resolve) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("scope", scope);
        if (productId) fd.append("productId", productId);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/upload");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = async () => {
          setProgress(null);
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 400) { setError(json.error ?? "Échec de l'envoi"); }
            else await onUploaded({ ...json, name: file.name, size: file.size, mime: file.type });
          } catch { setError("Réponse invalide du serveur"); }
          resolve();
        };
        xhr.onerror = () => { setProgress(null); setError("Erreur réseau"); resolve(); };
        xhr.send(fd);
      });
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
        <span className="text-xs text-ink-muted">{scope === "private" ? "Stockage privé — jamais accessible publiquement" : "Images publiques (JPG, PNG, WebP, SVG)"} · 50 Mo max</span>
        <input ref={inputRef} type="file" className="sr-only" accept={accept} multiple={multiple} onChange={(e) => e.target.files && void upload(e.target.files)} />
      </div>
      {progress !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10" aria-label="Progression"><div className="h-full bg-coral transition-all" style={{ width: `${progress}%` }} /></div>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-600" role="alert">{error}</p>}
    </div>
  );
}
