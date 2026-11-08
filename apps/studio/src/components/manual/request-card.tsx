"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Image as ImageIcon, Type, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cancelRequestAction, resolveBatchAction, resolveImageRequestAction, resolveTextRequestAction } from "@/app/actions/manual";

export interface ManualRequestView {
  id: string;
  kind: "TEXT" | "IMAGE";
  title: string;
  prompt: string;
  expectedFormat: string | null;
  error: string | null;
  createdAt: string;
  bookId: string | null;
  activityId: string | null;
  activityTitle: string | null;
  jobId: string | null;
  jobLabel: string | null;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = "Copier le prompt" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copié !" : label}
    </Button>
  );
}

function AssistantLinks() {
  return (
    <>
      <Button asChild size="sm" variant="secondary"><a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir Claude</a></Button>
      <Button asChild size="sm" variant="secondary"><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir ChatGPT</a></Button>
    </>
  );
}

export function ManualRequestCard({ request }: { request: ManualRequestView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(request.error);
  const [info, setInfo] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const afterResolve = (resumed: "requeued" | "waiting" | "none") => {
    setInfo(resumed === "requeued" ? "Réponse enregistrée : la tâche reprend automatiquement." : resumed === "waiting" ? "Réponse enregistrée. D'autres réponses sont encore attendues pour cette tâche." : "Réponse enregistrée.");
    setError(null);
    setTimeout(() => router.refresh(), 600);
  };

  const submitText = () =>
    start(async () => {
      const r = await resolveTextRequestAction(request.id, response);
      if (r.ok) afterResolve(r.resumed);
      else setError(r.error);
    });

  const submitFile = (file: File) =>
    start(async () => {
      const fd = new FormData();
      fd.set("requestId", request.id);
      fd.set("file", file);
      const r = await resolveImageRequestAction(fd);
      if (r.ok) afterResolve(r.resumed);
      else setError(r.error);
    });

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-bold">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${request.kind === "TEXT" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"}`}>{request.kind === "TEXT" ? <Type className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}</span>
            <span className="truncate">{request.title}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {request.jobLabel && <span>{request.jobLabel}</span>}
            {request.activityId && <> · <Link href={`/activities/${request.activityId}`} className="hover:underline">{request.activityTitle ?? "activité"}</Link></>}
            {request.expectedFormat && <> · Attendu : {request.expectedFormat}</>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={request.prompt} />
          <AssistantLinks />
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm("Annuler cette demande ? La tâche restera en attente.")) start(async () => { await cancelRequestAction(request.id); router.refresh(); }); }}>
            <XCircle className="h-3.5 w-3.5" /> Annuler
          </Button>
        </div>
      </header>

      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800">{open ? "Masquer le prompt" : "Afficher le prompt"}</button>
      {open && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{request.prompt}</pre>}

      <div className="mt-4">
        {request.kind === "TEXT" ? (
          <div className="space-y-2">
            <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Collez la réponse de l'assistant ici (le JSON, avec ou sans balises ```)" className="min-h-[120px] font-mono text-xs" />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="success" disabled={pending || response.trim().length < 2} onClick={submitText}><Check className="h-3.5 w-3.5" /> Valider la réponse</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={async () => { const t = await navigator.clipboard.readText().catch(() => ""); if (t) setResponse(t); }}>Coller depuis le presse-papiers</Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) submitFile(f); }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"}`}
          >
            <Upload className="h-5 w-5 text-slate-400" />
            <p className="text-slate-600">Déposez l'image générée ici (PNG, JPG ou WebP), ou</p>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => fileRef.current?.click()}>Choisir un fichier</Button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) submitFile(f); }} />
          </div>
        )}
        {pending && <p className="mt-2 text-xs text-slate-500">Enregistrement…</p>}
        {error && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700 whitespace-pre-wrap">{error}</p>}
        {info && <p className="mt-2 rounded bg-emerald-50 p-2 text-xs text-emerald-800">{info}</p>}
      </div>
    </article>
  );
}

/** Copie groupée de toutes les demandes texte d'un livre + collage multi-réponses. */
export function BatchPaste({ prompt, count }: { prompt: string; count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ resolved: number; errors: string[]; resumed: number } | null>(null);
  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-bold text-blue-900">Tout copier : {count} demandes texte en un seul prompt</p>
          <p className="text-blue-800/80">L'assistant répondra à chaque demande après une ligne « ### DEMANDE identifiant » ; collez ensuite tout le résultat ci-dessous.</p>
        </div>
        <div className="flex gap-2">
          <CopyButton text={prompt} label="Tout copier" />
          <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>{open ? "Fermer" : "Coller plusieurs réponses"}</Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Collez ici la réponse complète (toutes les sections ### DEMANDE …)" className="min-h-[140px] font-mono text-xs" />
          <Button size="sm" variant="success" disabled={pending || text.trim().length < 10} onClick={() => start(async () => { const r = await resolveBatchAction(text); setResult(r); if (r.resolved > 0) { setText(""); setTimeout(() => router.refresh(), 600); } })}>
            <Check className="h-3.5 w-3.5" /> Valider les réponses
          </Button>
          {result && (
            <div className="text-xs">
              <p className="text-emerald-800">{result.resolved} réponse{result.resolved > 1 ? "s" : ""} enregistrée{result.resolved > 1 ? "s" : ""}{result.resumed > 0 ? ` · ${result.resumed} tâche(s) relancée(s)` : ""}</p>
              {result.errors.map((e, i) => <p key={i} className="text-red-700">{e}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
