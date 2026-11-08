import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="container-shell py-10" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-4 h-12 w-2/3 max-w-xl" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card-soft overflow-hidden"><Skeleton className="aspect-[4/3] rounded-none" /><div className="space-y-2 p-5"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-9 w-full" /></div></div>
        ))}
      </div>
    </div>
  );
}
