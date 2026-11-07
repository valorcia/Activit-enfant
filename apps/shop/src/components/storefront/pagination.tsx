import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pagination par liens (SEO-friendly), conserve les autres paramètres d'URL. */
export function Pagination({ page, pages, basePath, params, className }: { page: number; pages: number; basePath: string; params: Record<string, string | undefined>; className?: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p)); else sp.delete("page");
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const windowPages = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);
  const items: Array<number | "…"> = [];
  for (const p of windowPages) {
    if (items.length && typeof items[items.length - 1] === "number" && p - (items[items.length - 1] as number) > 1) items.push("…");
    items.push(p);
  }
  const btn = "grid size-10 place-items-center rounded-full font-heading font-bold transition-colors";
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1.5", className)}>
      {page > 1 ? <Link href={href(page - 1)} rel="prev" aria-label="Page précédente" className={cn(btn, "bg-white shadow-card hover:bg-honey-light")}><ChevronLeft className="size-5" /></Link> : <span className={cn(btn, "text-ink-muted/50")}><ChevronLeft className="size-5" /></span>}
      {items.map((it, i) =>
        it === "…" ? <span key={`e${i}`} className="px-1 text-ink-muted">…</span> : (
          <Link key={it} href={href(it)} aria-current={it === page ? "page" : undefined} className={cn(btn, it === page ? "bg-coral text-white" : "bg-white shadow-card hover:bg-honey-light")}>{it}</Link>
        ),
      )}
      {page < pages ? <Link href={href(page + 1)} rel="next" aria-label="Page suivante" className={cn(btn, "bg-white shadow-card hover:bg-honey-light")}><ChevronRight className="size-5" /></Link> : <span className={cn(btn, "text-ink-muted/50")}><ChevronRight className="size-5" /></span>}
    </nav>
  );
}
