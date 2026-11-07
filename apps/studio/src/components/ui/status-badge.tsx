import { Badge } from "./badge";

const BOOK: Record<string, [string, "default" | "secondary" | "success" | "warning" | "destructive" | "purple"]> = {
  DRAFT: ["Brouillon", "secondary"],
  PLANNED: ["Sommaire validé", "default"],
  GENERATING: ["En production", "warning"],
  REVIEW: ["À valider", "purple"],
  READY: ["Prêt", "success"],
  EXPORTED: ["Exporté", "success"],
  ARCHIVED: ["Archivé", "secondary"],
};
const ACTIVITY: Record<string, [string, "default" | "secondary" | "success" | "warning" | "destructive" | "purple"]> = {
  CONCEPT: ["Concept", "secondary"],
  DRAFT: ["Brouillon", "secondary"],
  REVIEW: ["À valider", "purple"],
  BLOCKED: ["Bloquée (sécurité)", "destructive"],
  VALIDATED: ["Validée", "success"],
  ARCHIVED: ["Archivée", "secondary"],
};
const JOB: Record<string, [string, "default" | "secondary" | "success" | "warning" | "destructive" | "purple"]> = {
  QUEUED: ["En file", "secondary"],
  RUNNING: ["En cours", "warning"],
  PAUSED: ["En pause", "purple"],
  COMPLETED: ["Terminé", "success"],
  FAILED: ["Échec", "destructive"],
  CANCELLED: ["Annulé", "secondary"],
};
const ILL: Record<string, [string, "default" | "secondary" | "success" | "warning" | "destructive" | "purple"]> = {
  PENDING: ["En attente", "secondary"],
  GENERATING: ["Génération", "warning"],
  GENERATED: ["À vérifier", "purple"],
  ACCEPTED: ["Acceptée", "success"],
  REJECTED: ["Refusée", "destructive"],
  FAILED: ["Échec", "destructive"],
};
const EXPORT: Record<string, [string, "default" | "secondary" | "success" | "warning" | "destructive" | "purple"]> = {
  QUEUED: ["En file", "secondary"],
  RUNNING: ["Rendu", "warning"],
  COMPLETED: ["Disponible", "success"],
  FAILED: ["Échec", "destructive"],
};

export function StatusBadge({ kind, status }: { kind: "book" | "activity" | "job" | "illustration" | "export"; status: string }) {
  const map = { book: BOOK, activity: ACTIVITY, job: JOB, illustration: ILL, export: EXPORT }[kind];
  const [label, variant] = map[status] ?? [status, "secondary"];
  return <Badge variant={variant}>{label}</Badge>;
}
