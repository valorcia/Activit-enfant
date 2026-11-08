"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteAdVideoAction, sendAdVideoToShopAction } from "@/app/actions/videos";
import type { AdVideoView } from "@/lib/video/service";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "purple" }> = {
  QUEUED: { label: "En file", variant: "secondary" },
  RENDERING: { label: "Montage", variant: "default" },
  WAITING_CLIP: { label: "Clip en attente", variant: "purple" },
  READY: { label: "Prête", variant: "success" },
  FAILED: { label: "Échec", variant: "destructive" },
};
const FORMAT: Record<string, string> = { story: "9:16", square: "1:1", landscape: "16:9" };

export function VideoList({ videos, showBook = false }: { videos: AdVideoView[]; showBook?: boolean }) {
  const router = useRouter();
  const active = videos.some((v) => v.status !== "READY" && v.status !== "FAILED");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [active, router]);

  if (videos.length === 0) return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Aucune vidéo pour l&apos;instant.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {videos.map((v) => <VideoCard key={v.id} video={v} showBook={showBook} />)}
    </div>
  );
}

function VideoCard({ video: v, showBook }: { video: AdVideoView; showBook: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const s = STATUS[v.status] ?? STATUS.QUEUED;
  const aspect = v.format === "story" ? "aspect-[9/16] max-h-80" : v.format === "square" ? "aspect-square" : "aspect-video";
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`mx-auto flex w-full items-center justify-center bg-slate-900 ${aspect}`}>
        {v.videoUrl ? (
          <video src={v.videoUrl} poster={v.thumbnailUrl ?? undefined} controls preload="metadata" className="h-full w-full object-contain" />
        ) : (
          <div className="p-4 text-center text-xs text-slate-300">{v.step ?? s.label}</div>
        )}
      </div>
      <div className="space-y-2 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={s.variant}>{s.label}</Badge>
          <span className="text-xs text-slate-500">{FORMAT[v.format] ?? v.format} · {v.durationSeconds} s{v.costUsd > 0 ? ` · ${v.costUsd.toFixed(2)} $` : ""}</span>
        </div>
        {showBook && <Link href={`/books/${v.bookId}?tab=videos`} className="block truncate font-semibold hover:underline">{v.bookTitle}</Link>}
        {v.step && v.status !== "READY" && <p className="text-xs text-slate-600">{v.step}</p>}
        {v.status === "WAITING_CLIP" && v.clipProvider === "manual" && <Link href="/manual" className="text-xs font-semibold text-violet-700 hover:underline">Téléverser le clip dans « À coller » →</Link>}
        {v.error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{v.error}</p>}
        {message && <p className="rounded bg-slate-50 p-2 text-xs text-slate-700">{message}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {v.videoUrl && <Button asChild size="sm" variant="secondary"><a href={`${v.videoUrl}?download=1`}><Download className="h-3.5 w-3.5" /> Télécharger</a></Button>}
          {v.shopVideoUrl ? (
            <Button asChild size="sm" variant="secondary"><a href={v.shopVideoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> En boutique</a></Button>
          ) : (
            v.videoUrl && (
              <Button size="sm" variant="secondary" disabled={pending || !v.bookLinkedToShop} title={v.bookLinkedToShop ? undefined : "Publiez d'abord le livre dans la boutique"} onClick={() => start(async () => { const r = await sendAdVideoToShopAction(v.id, v.bookId); setMessage(r.ok ? "Vidéo envoyée à la boutique." : r.error); router.refresh(); })}>
                <Send className="h-3.5 w-3.5" /> Envoyer à la boutique
              </Button>
            )
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm("Supprimer cette vidéo ?")) start(async () => { await deleteAdVideoAction(v.id, v.bookId); router.refresh(); }); }}>
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </Button>
        </div>
      </div>
    </article>
  );
}
