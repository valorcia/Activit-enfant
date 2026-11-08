"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Share2, Music2, RefreshCw, Unplug, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { disconnectAccountAction } from "@/app/actions/admin/marketing-social";
import { formatDate } from "@/lib/utils";

export interface AccountRow { id: string; provider: "META" | "TIKTOK"; kind: string; name: string; username: string | null; avatarUrl: string | null; needsReconnect: boolean; tokenExpiresAt: string | null; parentId: string | null }

const KIND_LABEL: Record<string, string> = { PAGE: "Page Facebook", INSTAGRAM: "Instagram", TIKTOK: "Compte TikTok", AD_ACCOUNT: "Compte publicitaire" };

export function SocialConnectors({ accounts, configured, conversions }: { accounts: AccountRow[]; configured: Record<"META" | "TIKTOK", boolean>; conversions: { meta: boolean; tiktok: boolean } }) {
  const router = useRouter();
  const providers: Array<{ key: "META" | "TIKTOK"; label: string; icon: React.ReactNode; help: string; tool: { label: string; href: string } }> = [
    { key: "META", label: "Meta (Facebook & Instagram)", icon: <Share2 className="size-5" />, help: "Pages Facebook, comptes Instagram professionnels rattachés et comptes publicitaires.", tool: { label: "Meta Business Suite", href: "https://business.facebook.com/latest/home" } },
    { key: "TIKTOK", label: "TikTok", icon: <Music2 className="size-5" />, help: "Compte créateur (publication de photos) ; comptes publicitaires via TikTok for Business.", tool: { label: "TikTok for Business", href: "https://ads.tiktok.com/" } },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {providers.map((p) => {
        const mine = accounts.filter((a) => a.provider === p.key);
        const needs = mine.some((a) => a.needsReconnect);
        return (
          <section key={p.key} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-ink text-white">{p.icon}</span><div><h2 className="font-heading text-lg font-bold">{p.label}</h2><p className="text-xs text-ink-soft">{p.help}</p></div></div>
              {configured[p.key] ? <Badge variant="success"><Check /> App configurée</Badge> : <Badge variant="warning"><AlertTriangle /> Identifiants manquants</Badge>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant={mine.length ? "outline" : "admin"} disabled={!configured[p.key]}>
                <a href={`/api/admin/social/${p.key.toLowerCase()}/connect`}>{mine.length ? <><RefreshCw className="size-4" /> Reconnecter</> : "Connecter"}</a>
              </Button>
              <Button asChild size="sm" variant="ghost"><a href={p.tool.href} target="_blank" rel="noopener noreferrer">{p.tool.label} ↗</a></Button>
            </div>
            {needs && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Un jeton a expiré ou a été révoqué : reconnectez le compte.</p>}
            <ul className="mt-4 divide-y divide-line text-sm">
              {mine.length === 0 && <li className="py-3 text-ink-soft">Aucun compte connecté. {configured[p.key] ? "Cliquez sur Connecter." : <>Renseignez les identifiants de l&apos;application dans <a href="/admin/parametres?onglet=integration" className="font-semibold text-coral-dark underline">Paramètres → Intégrations</a>.</>}</li>}
              {mine.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  {a.avatarUrl ? <img src={a.avatarUrl} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-ink/5 text-xs font-bold">{a.name.charAt(0)}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.name} {a.username && <span className="text-ink-muted">@{a.username}</span>}</p>
                    <p className="text-xs text-ink-soft">{KIND_LABEL[a.kind] ?? a.kind}{a.tokenExpiresAt ? ` · jeton jusqu'au ${formatDate(a.tokenExpiresAt)}` : ""}{a.needsReconnect ? " · à reconnecter" : ""}</p>
                  </div>
                  <ConfirmButton size="icon-sm" variant="ghost" title="Déconnecter ce compte ?" description="Le jeton sera révoqué localement. Les posts publiés ne sont pas supprimés." confirmLabel="Déconnecter" onConfirm={async () => { const r = await disconnectAccountAction(a.id); if (r.ok) { toast.success("Compte déconnecté"); router.refresh(); } return r; }}>
                    <Unplug className="size-4" />
                  </ConfirmButton>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className="rounded-2xl border border-line bg-white p-5 lg:col-span-2">
        <h2 className="font-heading text-lg font-bold">Conversions serveur (achats)</h2>
        <p className="mt-1 text-sm text-ink-soft">Chaque commande payée est envoyée à Meta (Conversions API) et TikTok (Events API) avec l'email haché et un identifiant d'événement égal au numéro de commande, pour dédupliquer avec le pixel. Réglages dans <Link href="/admin/parametres" className="underline">Paramètres → Analytics</Link>.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={conversions.meta ? "success" : "soft"}>Meta CAPI : {conversions.meta ? "actif" : "non configuré"}</Badge>
          <Badge variant={conversions.tiktok ? "success" : "soft"}>TikTok Events : {conversions.tiktok ? "actif" : "non configuré"}</Badge>
        </div>
      </section>
    </div>
  );
}
