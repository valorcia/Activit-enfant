"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteCampaignAction } from "@/app/actions/admin/marketing-social";

export function DeleteCampaignButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton size="sm" variant="ghost" title="Supprimer cette campagne ?" description="Les dépenses saisies seront supprimées ; les posts et les commandes sont conservés." confirmLabel="Supprimer"
      onConfirm={async () => { const r = await deleteCampaignAction(id); if (r.ok) router.push("/admin/marketing/campagnes"); return r; }}>
      <Trash2 className="size-4" /> Supprimer
    </ConfirmButton>
  );
}
