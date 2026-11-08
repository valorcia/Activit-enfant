"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Check, Copy, Download, ExternalLink, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormField, toLocalInput } from "@/components/admin/form-controls";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { composePostText } from "@/lib/social/copywriter";
import { deletePostAction, markPublishedManuallyAction, publishPostNowAction, updatePostAction } from "@/app/actions/admin/marketing-social";

export interface PostView {
  id: string; provider: "META" | "TIKTOK"; format: string; status: string; hook: string | null; body: string; cta: string | null; headline: string | null; hashtags: string[]; imageUrls: string[]; linkUrl: string | null;
  scheduledAt: string | null; publishedAt: string | null; externalUrl: string | null; error: string | null; generatedBy: string; variantLabel: string | null;
  accountId: string | null; campaignId: string | null; productId: string | null; productName: string | null; accountName: string | null; campaignName: string | null;
}

const STATUS: Record<string, { label: string; variant: "soft" | "info" | "warning" | "success" | "danger" }> = {
  DRAFT: { label: "Brouillon", variant: "soft" }, SCHEDULED: { label: "Programmé", variant: "info" }, PUBLISHING: { label: "Publication…", variant: "warning" }, PUBLISHED: { label: "Publié", variant: "success" }, FAILED: { label: "Échec", variant: "danger" },
};

function channelLabel(p: PostView, accountKind?: string | null) {
  if (p.provider === "TIKTOK") return "TikTok";
  if (p.format === "AD_PRIMARY_TEXT") return "Publicité Meta";
  return accountKind === "INSTAGRAM" ? "Instagram" : "Facebook / Instagram";
}

export function PostCard({ post, accounts, campaigns, productImages }: { post: PostView; accounts: Array<{ id: string; name: string; provider: string; kind: string; needsReconnect: boolean }>; campaigns: Array<{ id: string; name: string; productId: string | null }>; productImages: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ hook: post.hook ?? "", body: post.body, cta: post.cta ?? "", headline: post.headline ?? "", hashtags: post.hashtags.join(" "), imageUrl: post.imageUrls[0] ?? "", accountId: post.accountId ?? "", campaignId: post.campaignId ?? "", scheduledAt: toLocalInput(post.scheduledAt) });
  const [copied, setCopied] = useState(false);
  const account = accounts.find((a) => a.id === post.accountId);
  const channel = post.provider === "TIKTOK" ? "tiktok" : post.format === "AD_PRIMARY_TEXT" ? "meta_ad" : account?.kind === "INSTAGRAM" ? "instagram" : "facebook";
  const fullText = composePostText({ hook: f.hook, body: f.body, cta: f.cta, hashtags: f.hashtags.split(/\s+/).filter(Boolean), linkUrl: post.linkUrl }, channel);
  const compatible = accounts.filter((a) => a.provider === post.provider && (post.provider === "TIKTOK" ? a.kind === "TIKTOK" : a.kind !== "TIKTOK"));
  const externalTool = post.provider === "TIKTOK" ? { label: "Publier sur TikTok", href: "https://www.tiktok.com/upload" } : { label: "Meta Business Suite", href: "https://business.facebook.com/latest/composer" };

  const save = (extra: Partial<typeof f> = {}) => start(async () => {
    const v = { ...f, ...extra };
    const r = await updatePostAction(post.id, { hook: v.hook || null, body: v.body, cta: v.cta || null, headline: v.headline || null, hashtags: v.hashtags, imageUrls: v.imageUrl ? [v.imageUrl] : [], accountId: v.accountId || null, campaignId: v.campaignId || null, scheduledAt: v.scheduledAt || undefined });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(v.scheduledAt ? "Post programmé" : "Post enregistré"); setEdit(false); router.refresh();
  });

  return (
    <article className="rounded-2xl border border-line bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={STATUS[post.status]?.variant ?? "soft"}>{STATUS[post.status]?.label ?? post.status}</Badge>
          <span className="font-bold">{channelLabel(post, account?.kind)}</span>
          {post.variantLabel && <span className="rounded-full bg-cream px-2 py-0.5 font-semibold">{post.variantLabel}</span>}
          {post.productName && <span className="text-ink-muted">· {post.productName}</span>}
          {post.campaignName && <span className="text-ink-muted">· {post.campaignName}</span>}
          <span className="text-ink-muted">· {post.generatedBy === "api" ? "API" : "collé"}</span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEdit((e) => !e)}>{edit ? "Fermer" : "Modifier"}</Button>
          <ConfirmButton size="icon-sm" variant="ghost" title="Supprimer ce post ?" confirmLabel="Supprimer" onConfirm={async () => { const r = await deletePostAction(post.id); if (r.ok) router.refresh(); return r; }}><Trash2 className="size-4" /></ConfirmButton>
        </div>
      </header>

      <div className="mt-3 grid gap-4 md:grid-cols-[180px_1fr]">
        {/* Aperçu façon réseau social */}
        <div className="rounded-2xl border border-line bg-cream/60 p-2">
          <div className="mb-2 flex items-center gap-2 px-1"><span className="size-6 rounded-full bg-ink/10" /><span className="text-[11px] font-bold">{account?.name ?? "Votre compte"}</span></div>
          <div className="aspect-square overflow-hidden rounded-xl bg-ink/5">{f.imageUrl ? <img src={f.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-ink-muted">Pas d'image</div>}</div>
          <p className="mt-2 line-clamp-6 whitespace-pre-wrap px-1 text-[11px] leading-snug">{fullText}</p>
        </div>

        <div className="min-w-0">
          {edit ? (
            <div className="space-y-3">
              <FormField label="Accroche" htmlFor={`h-${post.id}`}><Input id={`h-${post.id}`} value={f.hook} onChange={(e) => setF({ ...f, hook: e.target.value })} /></FormField>
              <FormField label="Texte" htmlFor={`b-${post.id}`} hint={`${f.body.length} caractères`}><Textarea id={`b-${post.id}`} rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Appel à l'action" htmlFor={`c-${post.id}`}><Input id={`c-${post.id}`} value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} /></FormField>
                {post.format === "AD_PRIMARY_TEXT" && <FormField label="Titre de publicité (≤ 40)" htmlFor={`t-${post.id}`}><Input id={`t-${post.id}`} maxLength={40} value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} /></FormField>}
                <FormField label="Hashtags" htmlFor={`hs-${post.id}`}><Input id={`hs-${post.id}`} value={f.hashtags} onChange={(e) => setF({ ...f, hashtags: e.target.value })} /></FormField>
                <FormField label="Image" htmlFor={`i-${post.id}`}><NativeSelect id={`i-${post.id}`} value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })}><option value="">— Aucune —</option>{[...new Set([...(f.imageUrl ? [f.imageUrl] : []), ...productImages])].map((u) => <option key={u} value={u}>{u.split("/").pop()}</option>)}</NativeSelect></FormField>
                <FormField label="Campagne" htmlFor={`cp-${post.id}`}><NativeSelect id={`cp-${post.id}`} value={f.campaignId} onChange={(e) => setF({ ...f, campaignId: e.target.value })}><option value="">— Lien organique —</option>{campaigns.filter((c) => !c.productId || c.productId === post.productId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></FormField>
                <FormField label="Compte de publication" htmlFor={`a-${post.id}`} hint={compatible.length ? undefined : "Aucun compte connecté : publication manuelle"}><NativeSelect id={`a-${post.id}`} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}><option value="">— Manuel (copier) —</option>{compatible.map((a) => <option key={a.id} value={a.id} disabled={a.needsReconnect}>{a.name}{a.needsReconnect ? " (à reconnecter)" : ""}</option>)}</NativeSelect></FormField>
                <FormField label="Programmer pour" htmlFor={`s-${post.id}`}><Input id={`s-${post.id}`} type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></FormField>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="admin" disabled={pending} onClick={() => save()}>{f.scheduledAt ? <><CalendarClock className="size-4" /> Enregistrer et programmer</> : "Enregistrer"}</Button>
              </div>
            </div>
          ) : (
            <>
              {post.headline && <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Titre : {post.headline}</p>}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{fullText}</p>
              {post.linkUrl && <p className="mt-2 truncate text-xs text-ink-muted">Lien : {post.linkUrl}</p>}
              {post.scheduledAt && post.status === "SCHEDULED" && <p className="mt-1 text-xs font-semibold text-sky-dark">Programmé le {new Date(post.scheduledAt).toLocaleString("fr-FR")}{post.accountName ? ` sur ${post.accountName}` : ""}</p>}
              {post.error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{post.error}</p>}
              {post.externalUrl && <a href={post.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-coral-dark hover:underline">Voir la publication <ExternalLink className="size-3" /></a>}
            </>
          )}

          {post.status !== "PUBLISHED" && !edit && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(fullText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copier le texte</Button>
              {post.imageUrls[0] && <Button asChild size="sm" variant="outline"><a href={post.imageUrls[0]} download target="_blank" rel="noopener noreferrer"><Download className="size-4" /> Image</a></Button>}
              <Button asChild size="sm" variant="ghost"><a href={externalTool.href} target="_blank" rel="noopener noreferrer">{externalTool.label} <ExternalLink className="size-3.5" /></a></Button>
              {post.accountId ? (
                <Button size="sm" variant="admin" disabled={pending} onClick={() => start(async () => { const r = await publishPostNowAction(post.id); if (!r.ok) { toast.error(r.error); } else toast.success("Publié"); router.refresh(); })}><Send className="size-4" /> Publier maintenant</Button>
              ) : (
                <ConfirmButton size="sm" variant="soft" title="Marquer comme publié ?" description="Pour un post publié à la main dans Meta Business Suite ou TikTok. Vous pourrez coller l'URL de la publication ensuite." confirmLabel="Marquer publié" onConfirm={async () => { const r = await markPublishedManuallyAction(post.id, null); if (r.ok) router.refresh(); return r; }}>Marquer publié (manuel)</ConfirmButton>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
