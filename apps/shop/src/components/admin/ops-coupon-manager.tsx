"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/admin/data-table";
import { FormField, centsToEuros, eurosToCents, toLocalInput } from "@/components/admin/form-controls";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteCouponAction, saveCouponAction } from "@/app/actions/admin/coupons";
import { formatDate, formatPrice } from "@/lib/utils";

export interface CouponView { id: string; code: string; description: string | null; type: "PERCENT" | "FIXED"; percentOff: number | null; amountOffCents: number | null; minSubtotalCents: number | null; maxUses: number | null; usedCount: number; startsAt: string | null; endsAt: string | null; isActive: boolean }

const empty = (): Partial<CouponView> => ({ code: "", type: "PERCENT", isActive: true });

export function CouponManager({ coupons }: { coupons: CouponView[] }) {
  const [editing, setEditing] = useState<Partial<CouponView> | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      code: fd.get("code"), description: fd.get("description"), type: fd.get("type"),
      percentOff: fd.get("percentOff"), amountOffCents: eurosToCents(fd.get("amountOff") as string), minSubtotalCents: eurosToCents(fd.get("minSubtotal") as string),
      maxUses: fd.get("maxUses"), startsAt: fd.get("startsAt"), endsAt: fd.get("endsAt"), isActive: fd.get("isActive") === "on",
    };
    start(async () => {
      const r = await saveCouponAction(editing?.id ?? null, payload);
      if (r.ok) { toast.success("Code enregistré"); setEditing(null); setFields({}); } else { setFields(r.fields ?? {}); toast.error(r.error); }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end"><Button variant="admin" size="sm" onClick={() => { setEditing(empty()); setFields({}); }}><Plus className="size-4" /> Nouveau code</Button></div>
      <DataTable
        rows={coupons} rowKey={(c) => c.id} empty="Aucun code promo."
        columns={[
          { key: "code", header: "Code", render: (c) => <button className="font-mono font-bold hover:underline" onClick={() => { setEditing(c); setFields({}); }}>{c.code}</button> },
          { key: "value", header: "Réduction", render: (c) => (c.type === "PERCENT" ? `${c.percentOff} %` : formatPrice(c.amountOffCents ?? 0)) },
          { key: "min", header: "Min. panier", render: (c) => (c.minSubtotalCents ? formatPrice(c.minSubtotalCents) : "—") },
          { key: "uses", header: "Utilisations", render: (c) => `${c.usedCount}${c.maxUses ? ` / ${c.maxUses}` : ""}` },
          { key: "dates", header: "Validité", render: (c) => `${c.startsAt ? formatDate(c.startsAt) : "…"} → ${c.endsAt ? formatDate(c.endsAt) : "…"}` },
          { key: "active", header: "Actif", render: (c) => <span className={c.isActive ? "font-bold text-sage-dark" : "text-ink-muted"}>{c.isActive ? "Oui" : "Non"}</span> },
          { key: "actions", header: "", className: "text-right", render: (c) => <ConfirmButton variant="ghost" size="sm" className="text-red-700" title={`Supprimer ${c.code} ?`} description="Si le code a déjà été utilisé, il sera seulement désactivé." confirmLabel="Supprimer" onConfirm={() => deleteCouponAction(c.id)} successMessage="Code supprimé">Supprimer</ConfirmButton> },
        ]}
      />
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Modifier le code" : "Nouveau code promo"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <FormField label="Code" htmlFor="code" error={fields.code} required><Input id="code" name="code" defaultValue={editing.code} className="uppercase" required /></FormField>
              <FormField label="Type" htmlFor="type"><NativeSelect id="type" name="type" defaultValue={editing.type ?? "PERCENT"}><option value="PERCENT">Pourcentage</option><option value="FIXED">Montant fixe</option></NativeSelect></FormField>
              <FormField label="Pourcentage (%)" htmlFor="percentOff" error={fields.percentOff} hint="Pour le type pourcentage"><Input id="percentOff" name="percentOff" type="number" min={1} max={100} defaultValue={editing.percentOff ?? ""} /></FormField>
              <FormField label="Montant (€)" htmlFor="amountOff" error={fields.amountOffCents} hint="Pour le type montant fixe"><Input id="amountOff" name="amountOff" inputMode="decimal" defaultValue={centsToEuros(editing.amountOffCents)} /></FormField>
              <FormField label="Panier minimum (€)" htmlFor="minSubtotal"><Input id="minSubtotal" name="minSubtotal" inputMode="decimal" defaultValue={centsToEuros(editing.minSubtotalCents)} /></FormField>
              <FormField label="Utilisations max" htmlFor="maxUses"><Input id="maxUses" name="maxUses" type="number" min={1} defaultValue={editing.maxUses ?? ""} /></FormField>
              <FormField label="Début" htmlFor="startsAt"><Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocalInput(editing.startsAt)} /></FormField>
              <FormField label="Fin" htmlFor="endsAt"><Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocalInput(editing.endsAt)} /></FormField>
              <FormField label="Description interne" htmlFor="description" className="sm:col-span-2"><Textarea id="description" name="description" defaultValue={editing.description ?? ""} className="min-h-[60px]" /></FormField>
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" name="isActive" defaultChecked={editing.isActive ?? true} className="size-4 accent-coral" /> Code actif</label>
              <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Annuler</Button><Button type="submit" variant="admin" disabled={pending}>{pending ? "…" : "Enregistrer"}</Button></div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
