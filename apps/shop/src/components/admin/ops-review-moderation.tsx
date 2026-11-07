"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteReviewAction, moderateReviewAction } from "@/app/actions/admin/reviews";

export function ReviewModeration({ reviewId, status }: { reviewId: string; status: string }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const run = (decision: "APPROVED" | "REJECTED") => start(async () => { const r = await moderateReviewAction(reviewId, decision, note); r.ok ? toast.success(r.message) : toast.error(r.error); });
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note de modération (interne)" className="h-9 max-w-xs text-sm" />
      {status !== "APPROVED" && <Button size="sm" variant="sage" disabled={pending} onClick={() => run("APPROVED")}>Approuver</Button>}
      {status !== "REJECTED" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run("REJECTED")}>Rejeter</Button>}
      <ConfirmButton size="sm" variant="ghost" className="text-red-700" title="Supprimer cet avis ?" description="Cette action est définitive." confirmLabel="Supprimer" successMessage="Avis supprimé" onConfirm={() => deleteReviewAction(reviewId)}>Supprimer</ConfirmButton>
    </div>
  );
}
