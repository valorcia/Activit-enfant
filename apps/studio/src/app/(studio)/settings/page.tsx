import { getAiSettings, getShopSettings, getStudioSettings, getVideoSettings, maskShopSettings, maskVideoSettings, providerAvailability } from "@/lib/settings";
import { VideoSettingsForm } from "@/components/video-settings-form";
import { StudioSettingsForm } from "@/components/studio-settings-form";
import { ShopSettingsForm } from "@/components/shop-settings-form";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getAiSettings();
  const availability = providerAvailability();
  const shop = maskShopSettings(await getShopSettings());
  const studio = await getStudioSettings();
  const video = maskVideoSettings(await getVideoSettings());
  const spent = await prisma.generationLog.groupBy({ by: ["provider", "kind"], _sum: { costUsd: true }, _count: { _all: true } });
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader title="Paramètres" description="Fournisseurs, modèles, qualité et budgets. Les clés API sont lues uniquement depuis les variables d'environnement du serveur et ne sont jamais envoyées au navigateur." />
      <div className="mb-8"><StudioSettingsForm initial={studio} /></div>
      <SettingsForm initial={settings} availability={availability} />
      <div className="mt-8"><ShopSettingsForm initial={shop} /></div>
      <div className="mt-8"><VideoSettingsForm initial={video} /></div>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold mb-2">Dépenses enregistrées</h2>
        {spent.length === 0 && <p className="text-sm text-slate-500">Aucune génération pour l'instant.</p>}
        <ul className="text-sm space-y-1">
          {spent.map((s) => (
            <li key={`${s.provider}-${s.kind}`} className="flex justify-between"><span>{s.provider} · {s.kind === "text" ? "texte" : "images"} ({s._count._all} appels)</span><span className="font-semibold">{formatUsd(Number(s._sum.costUsd ?? 0))}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
