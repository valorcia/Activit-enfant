"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Trash2 } from "lucide-react";
import { approvePreviewAction, deleteSubmissionAction } from "@/app/actions/creator";
import { Button } from "@/components/ui/button";

export function ApprovePreviewButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="lg" variant="sage" disabled={pending} onClick={() => {
      if (!window.confirm("Vous confirmez que l'aperçu vous convient et peut être mis en vente ?")) return;
      start(async () => { const r = await approvePreviewAction(id); if (r.ok) { toast.success("Merci ! Votre tutoriel va être mis en vente."); router.refresh(); } else toast.error(r.error); });
    }}><CheckCircle2 className="size-5" /> {pending ? "Validation…" : "Je valide"}</Button>
  );
}

export function DeleteDraftButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" className="text-red-700" disabled={pending} onClick={() => {
      if (!window.confirm("Supprimer ce brouillon ?")) return;
      start(async () => { const r = await deleteSubmissionAction(id); if (r.ok) { toast.success("Brouillon supprimé"); router.push("/espace-createur/idees"); } else toast.error(r.error); });
    }}><Trash2 className="size-4" /> Supprimer le brouillon</Button>
  );
}
