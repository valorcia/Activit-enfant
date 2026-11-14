import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { VideoList } from "@/components/videos/video-list";
import { listAdVideos } from "@/lib/video/service";
import { getVideoSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const [videos, settings] = await Promise.all([listAdVideos(), getVideoSettings()]);
  const ready = videos.filter((v) => v.status === "READY").length;
  const spent = videos.reduce((s, v) => s + v.costUsd, 0);
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <PageHeader
        title="Vidéos publicitaires"
        description="Montages Remotion aux couleurs de La Malle à Jeux, avec clip d'accroche animé (Runway ou copier-coller). Pour créer une vidéo, ouvrez un livre puis l'onglet « Vidéos pub »."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-2xl font-black">{videos.length}</div><div className="text-xs text-slate-500">vidéos</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-2xl font-black">{ready}</div><div className="text-xs text-slate-500">prêtes</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-2xl font-black">{spent.toFixed(2)} $</div><div className="text-xs text-slate-500">dépensés en clips Runway{settings.runwayApiKey ? "" : " · clé Runway non configurée"}</div></div>
      </div>
      <p className="mb-4 text-sm text-slate-600">Le montage est réalisé par le worker du studio : lancez <code className="rounded bg-slate-100 px-1">pnpm worker</code> (ou <code className="rounded bg-slate-100 px-1">pnpm worker:prod</code>) sur votre ordinateur. Réglages : <Link href="/settings#video" className="font-semibold text-blue-700 hover:underline">Paramètres → Vidéo</Link>.</p>
      <VideoList videos={videos} showBook />
    </div>
  );
}
