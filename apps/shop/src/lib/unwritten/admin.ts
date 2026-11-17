import "server-only";
import type { PersonalItemStatus } from "@prisma/client";
import { getAdminSite, getSites } from "@/lib/sites";

/** Libellés français des statuts des livres commandés (admin). */
export const ITEM_STATUS_LABELS: Record<PersonalItemStatus, string> = {
  AWAITING_RECIPIENT: "Attente du destinataire",
  PENDING_GENERATION: "En attente de génération",
  IN_PRODUCTION: "En production",
  ERROR: "Erreur",
  DELIVERED: "Livré",
  CANCELLED: "Annulé",
};

export const ITEM_STATUS_CLASSES: Record<PersonalItemStatus, string> = {
  AWAITING_RECIPIENT: "bg-lavender-light text-lavender-dark",
  PENDING_GENERATION: "bg-honey-light text-honey-dark",
  IN_PRODUCTION: "bg-sky-light text-sky-dark",
  ERROR: "bg-red-100 text-red-800",
  DELIVERED: "bg-sage-light text-sage-dark",
  CANCELLED: "bg-ink/5 text-ink-muted",
};

/** Marques personnalisées visibles selon le sélecteur de l'admin (toutes si « Tous les univers »). */
export async function adminPersonalizedSites() {
  const [sites, current] = await Promise.all([getSites(), getAdminSite()]);
  const personalized = sites.filter((s) => s.kind === "PERSONALIZED");
  return current ? personalized.filter((s) => s.id === current.id) : personalized;
}
