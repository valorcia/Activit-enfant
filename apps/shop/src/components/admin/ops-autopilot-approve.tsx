"use client";
import { useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approveAutopilotCampaignAction } from "@/app/actions/admin/marketing-social";

/** « Valider et programmer » : les brouillons d'une campagne autopilote passent en publication programmée. */
export function AutopilotApprove({ campaignId, draftCount, disabledReason }: { campaignId: string; draftCount: number; disabledReason?: string | null }) {
  const [pending, start] = useTransition();
  const [startAt, setStartAt] = useState("");
  const [spacing, setSpacing] = useState(24);
  const router = useRouter();
  if (draftCount === 0) return <p className="text-xs text-ink-muted">Aucun brouillon à valider.</p>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-semibold text-ink-soft">Début
        <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1 h-9 w-48" />
      </label>
      <label className="text-xs font-semibold text-ink-soft">Écart (h)
        <Input type="number" min={1} max={336} value={spacing} onChange={(e) => setSpacing(Number(e.target.value) || 24)} className="mt-1 h-9 w-20" />
      </label>
      <Button size="sm" variant="admin" disabled={pending || !!disabledReason} title={disabledReason ?? undefined}
        onClick={() => start(async () => {
          const r = await approveAutopilotCampaignAction(campaignId, { startAt: startAt ? new Date(startAt).toISOString() : null, spacingHours: spacing });
          if (!r.ok) { toast.error(r.error); return; }
          if (r.data.scheduled === 0) toast.warning(r.data.reason ?? "Aucun post programmé : connectez d'abord vos comptes");
          else toast.success(`${r.data.scheduled} publication(s) programmée(s)${r.data.skipped ? `, ${r.data.skipped} à publier manuellement` : ""}`);
          router.refresh();
        })}>
        <CalendarCheck className="size-4" /> {pending ? "Programmation…" : `Valider et programmer (${draftCount})`}
      </Button>
      {disabledReason && <p className="w-full text-xs text-amber-700">{disabledReason}</p>}
    </div>
  );
}
