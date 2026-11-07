"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { refundOrderAction, resendConfirmationAction, resetDownloadCountAction, toggleEntitlementAction } from "@/app/actions/admin/orders";
import { formatPrice } from "@/lib/utils";

export function OrderActions({ orderId, isPaid, canRefund, remainingCents, currency, hasPaymentIntent }: { orderId: string; isPaid: boolean; canRefund: boolean; remainingCents: number; currency: string; hasPaymentIntent: boolean }) {
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" disabled={!isPaid || pending} onClick={() => start(async () => { const r = await resendConfirmationAction(orderId); r.ok ? toast.success(r.message) : toast.error(r.error); })}>Renvoyer l&apos;email de confirmation</Button>
      {canRefund && isPaid && hasPaymentIntent && remainingCents > 0 && (
        <div className="rounded-xl border border-line bg-[#FBFAF7] p-3">
          <p className="text-sm font-bold">Remboursement</p>
          <p className="text-xs text-ink-muted">Reste remboursable : {formatPrice(remainingCents, currency)}. Le remboursement est émis via Stripe ; un remboursement total révoque les téléchargements.</p>
          <div className="mt-2 grid gap-2">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Montant en € (vide = total ${formatPrice(remainingCents, currency)})`} inputMode="decimal" className="h-9 text-sm" />
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (facultatif)" className="h-9 text-sm" />
            <ConfirmButton
              variant="danger" size="sm"
              title="Confirmer le remboursement"
              description={amount ? `Rembourser ${amount} € sur cette commande ?` : `Rembourser la totalité (${formatPrice(remainingCents, currency)}) ?`}
              confirmLabel="Rembourser"
              successMessage="Remboursement émis"
              onConfirm={async () => {
                const cents = amount ? Math.round(Number(amount.replace(",", ".")) * 100) : undefined;
                if (amount && (!Number.isFinite(cents) || (cents as number) <= 0)) return { ok: false, error: "Montant invalide" };
                const r = await refundOrderAction({ orderId, amountCents: cents, reason: reason || undefined });
                return r.ok ? { ok: true } : { ok: false, error: r.error };
              }}
            >Rembourser</ConfirmButton>
          </div>
        </div>
      )}
      {!canRefund && <p className="text-xs text-ink-muted">Les remboursements nécessitent le rôle Administrateur ou Support.</p>}
    </div>
  );
}

export interface EntitlementView { id: string; productName: string; downloadCount: number; maxDownloads: number; revokedAt: string | null; expiresAt: string | null; lastDownloadedAt: string | null; downloads: Array<{ id: string; at: string; file: string; ip: string }> }

export function EntitlementRow({ entitlement: e, canManage }: { entitlement: EntitlementView; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => { const r = await fn(); r.ok ? toast.success(r.message ?? "OK") : toast.error(r.error ?? "Erreur"); });
  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{e.productName} {e.revokedAt && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">révoqué</span>}</p>
          <p className="text-xs text-ink-muted">{e.downloadCount} / {e.maxDownloads} téléchargements{e.lastDownloadedAt ? ` · dernier le ${new Date(e.lastDownloadedAt).toLocaleString("fr-FR")}` : ""}{e.expiresAt ? ` · expire le ${new Date(e.expiresAt).toLocaleDateString("fr-FR")}` : ""}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>{open ? "Masquer" : "Journal"}</Button>
          {canManage && <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => resetDownloadCountAction(e.id))}>Réinitialiser</Button>}
          {canManage && <Button variant={e.revokedAt ? "soft" : "ghost"} size="sm" disabled={pending} className={e.revokedAt ? "" : "text-red-700"} onClick={() => run(() => toggleEntitlementAction(e.id, !e.revokedAt))}>{e.revokedAt ? "Réactiver" : "Révoquer"}</Button>}
        </div>
      </div>
      {open && (
        <ul className="mt-2 space-y-1 rounded-xl bg-[#FBFAF7] p-3 text-xs">
          {e.downloads.length === 0 ? <li className="text-ink-muted">Aucun téléchargement.</li> : e.downloads.map((d) => <li key={d.id}>{d.at} · {d.file} {d.ip ? <span className="text-ink-muted">· {d.ip}</span> : null}</li>)}
        </ul>
      )}
    </li>
  );
}
