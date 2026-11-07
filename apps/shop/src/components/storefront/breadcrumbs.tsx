import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { absoluteUrl, cn } from "@/lib/utils";
import { JsonLd } from "./json-ld";

export interface BreadcrumbItem { label: string; href?: string }

/** Fil d'Ariane accessible + données structurées BreadcrumbList. */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  const all: BreadcrumbItem[] = [{ label: "Accueil", href: "/" }, ...items];
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.label, ...(it.href ? { item: absoluteUrl(it.href) } : {}) })),
  };
  return (
    <nav aria-label="Fil d'Ariane" className={cn("text-sm text-ink-soft", className)}>
      <JsonLd data={data} />
      <ol className="flex flex-wrap items-center gap-1">
        {all.map((it, i) => {
          const last = i === all.length - 1;
          return (
            <li key={i} className="inline-flex items-center gap-1">
              {it.href && !last ? (
                <Link href={it.href} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold hover:bg-white hover:text-ink">
                  {i === 0 ? <><Home className="size-3.5" aria-hidden /><span className="sr-only">{it.label}</span></> : it.label}
                </Link>
              ) : (
                <span className={cn("px-1.5", last && "font-bold text-ink")} aria-current={last ? "page" : undefined}>{it.label}</span>
              )}
              {!last && <ChevronRight className="size-3.5 text-ink-muted" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
