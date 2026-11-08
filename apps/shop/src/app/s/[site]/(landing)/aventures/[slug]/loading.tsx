import { Skeleton } from "@/components/ui/misc";

export default function ProductLoading() {
  return (
    <div className="container-shell py-8" aria-busy="true" aria-label="Chargement de la fiche produit">
      <Skeleton className="h-4 w-48" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 lg:order-1">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-14 w-3/4" />
          <Skeleton className="h-6 w-full" />
          <div className="flex gap-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-28" /><Skeleton className="h-8 w-24" /></div>
          <Skeleton className="h-28 w-full rounded-3xl" />
        </div>
        <Skeleton className="aspect-[4/3] w-full rounded-[var(--radius-card)] lg:order-2" />
      </div>
    </div>
  );
}
