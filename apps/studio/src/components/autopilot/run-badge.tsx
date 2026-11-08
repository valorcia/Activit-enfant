import { Badge } from "@/components/ui/badge";

const RUN: Record<string, [string, "default" | "secondary" | "success" | "warning" | "destructive" | "purple"]> = {
  RUNNING: ["En cours", "warning"],
  WAITING_INPUT: ["Réponses à coller", "warning"],
  WAITING_APPROVAL: ["À valider", "purple"],
  COMPLETED: ["Terminé", "success"],
  FAILED: ["Échec", "destructive"],
  CANCELLED: ["Annulé", "secondary"],
};

export function RunBadge({ status }: { status: string }) {
  const [label, variant] = RUN[status] ?? [status, "secondary"];
  return <Badge variant={variant}>{label}</Badge>;
}

export function runStatusLabel(status: string) {
  return RUN[status]?.[0] ?? status;
}
