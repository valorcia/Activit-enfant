"use client";
import { useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { publishScheduledNowAction } from "@/app/actions/admin/products";

/** Déclenche la publication des produits programmés dont la date est passée (le cron Vercel gratuit ne passe qu'une fois par jour). */
export function PublishScheduledButton({ dueCount }: { dueCount: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline" size="sm" disabled={pending || dueCount === 0}
      title={dueCount === 0 ? "Aucun produit programmé dont la date est passée" : undefined}
      onClick={() => start(async () => {
        const res = await publishScheduledNowAction();
        if (!res.ok) { toast.error(res.error); return; }
        toast.success(res.data.published === 0 ? "Aucune publication en attente" : `${res.data.published} produit(s) publié(s)`);
        router.refresh();
      })}
    >
      <CalendarClock className="size-4" /> {pending ? "Publication…" : `Publier les programmés (${dueCount})`}
    </Button>
  );
}
