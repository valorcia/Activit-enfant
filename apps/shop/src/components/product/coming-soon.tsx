import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Remplace les boutons d'achat tant que le produit n'a aucun fichier à livrer. */
export function ComingSoon({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-line bg-cream px-4 py-3 text-center", className)} role="status">
      <p className="inline-flex items-center gap-2 font-heading text-lg font-bold"><Clock className="size-5" aria-hidden /> Bientôt disponible</p>
      <p className="mt-1 text-sm text-ink-soft">Ce kit est en cours de finalisation. Revenez très vite !</p>
    </div>
  );
}
