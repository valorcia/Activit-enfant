"use client";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { markMarketingEventProcessedAction, unsubscribeSubscriberAction } from "@/app/actions/admin/marketing";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { toast } from "sonner";

export function SubscriberActions({ id }: { id: string }) {
  return <ConfirmButton variant="ghost" size="sm" className="text-red-700" title="Désinscrire cet abonné ?" description="Un retrait de consentement sera enregistré." confirmLabel="Désinscrire" successMessage="Abonné désinscrit" onConfirm={() => unsubscribeSubscriberAction(id)}>Désinscrire</ConfirmButton>;
}

export function MarkProcessedButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await markMarketingEventProcessedAction(id); r.ok ? toast.success("Marqué traité") : toast.error(r.error ?? "Erreur"); })}>Marquer traité</Button>;
}
