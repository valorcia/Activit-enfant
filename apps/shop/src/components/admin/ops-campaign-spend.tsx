"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/form-controls";
import { deleteSpendAction, saveManualSpendAction, syncSpendAction } from "@/app/actions/admin/marketing-social";
import { formatDate, formatPrice } from "@/lib/utils";

export interface SpendRowView { id: string; date: string; spendCents: number; impressions: number | null; clicks: number | null; source: "API" | "MANUAL" }

export function CampaignSpend({ campaignId, canSync, rows }: { campaignId: string; canSync: boolean; rows: SpendRowView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), spendEuros: "", impressions: "", clicks: "" });
  const total = rows.reduce((s, r) => s + r.spendCents, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Date" htmlFor="sp-date"><Input id="sp-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-10" /></FormField>
        <FormField label="Dépense (€)" htmlFor="sp-amount"><Input id="sp-amount" inputMode="decimal" value={form.spendEuros} onChange={(e) => setForm({ ...form, spendEuros: e.target.value })} placeholder="12,40" className="h-10 w-28" /></FormField>
        <FormField label="Impressions" htmlFor="sp-imp"><Input id="sp-imp" inputMode="numeric" value={form.impressions} onChange={(e) => setForm({ ...form, impressions: e.target.value })} className="h-10 w-28" /></FormField>
        <FormField label="Clics" htmlFor="sp-clicks"><Input id="sp-clicks" inputMode="numeric" value={form.clicks} onChange={(e) => setForm({ ...form, clicks: e.target.value })} className="h-10 w-24" /></FormField>
        <Button size="sm" variant="admin" disabled={pending || !form.spendEuros} onClick={() => start(async () => { const r = await saveManualSpendAction(campaignId, form); if (!r.ok) { toast.error(r.error); return; } toast.success("Dépense enregistrée"); setForm({ ...form, spendEuros: "", impressions: "", clicks: "" }); router.refresh(); })}>Ajouter</Button>
        {canSync && <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await syncSpendAction(campaignId); if (!r.ok) { toast.error(r.error); return; } toast.success(`${r.data.days} jour(s) synchronisé(s)`); router.refresh(); })}><RefreshCw className="size-4" /> Synchroniser (30 j)</Button>}
      </div>
      {rows.length === 0 ? <p className="text-sm text-ink-soft">Aucune dépense enregistrée. Sans compte publicitaire connecté, saisissez chaque jour le montant indiqué par le Gestionnaire de publicités.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-muted border-b border-line"><th className="py-2">Date</th><th className="py-2 text-right">Dépense</th><th className="py-2 text-right">Impr.</th><th className="py-2 text-right">Clics</th><th className="py-2">Source</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <td className="py-1.5">{formatDate(r.date)}</td><td className="py-1.5 text-right font-semibold">{formatPrice(r.spendCents)}</td><td className="py-1.5 text-right">{r.impressions ?? "—"}</td><td className="py-1.5 text-right">{r.clicks ?? "—"}</td><td className="py-1.5 text-xs">{r.source === "API" ? "API" : "Manuel"}</td>
                <td className="py-1.5 text-right"><button className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label="Supprimer" onClick={() => start(async () => { const x = await deleteSpendAction(r.id); if (x.ok) router.refresh(); else toast.error(x.error); })}><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
            <tr><td className="py-2 font-bold">Total</td><td className="py-2 text-right font-bold">{formatPrice(total)}</td><td colSpan={4} /></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
