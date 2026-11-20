"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removePushSubscriptionAction } from "@/app/actions/admin/push";

const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export function PushDeviceRow({ id, label, owner, since, lastSuccess }: { id: string; label: string; owner: string; since: string; lastSuccess: string | null }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{label}</p>
        <p className="text-xs text-ink-muted">{owner} · depuis le {fmt(since)}{lastSuccess ? ` · dernière notification ${fmt(lastSuccess)}` : ""}</p>
      </div>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await removePushSubscriptionAction({ id }); if (r.ok) toast.success(r.message ?? "Retiré"); else toast.error(r.error); })}>Retirer</Button>
    </li>
  );
}
