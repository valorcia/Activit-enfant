import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({ title, description, breadcrumbs, actions, className }: { title: string; description?: string; breadcrumbs?: Array<{ label: string; href?: string }>; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Fil d'Ariane" className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink-muted">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {b.href ? <Link href={b.href} className="hover:text-ink">{b.label}</Link> : <span>{b.label}</span>}
                {i < breadcrumbs.length - 1 && <ChevronRight className="size-3" />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function AdminCard({ title, description, children, className, actions }: { title?: string; description?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="font-heading text-lg font-bold">{title}</h2>}
            {description && <p className="text-sm text-ink-soft">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-ink/10 text-ink", SCHEDULED: "bg-sky-light text-sky-dark", PUBLISHED: "bg-sage-light text-sage-dark", ARCHIVED: "bg-ink/5 text-ink-muted",
    PENDING: "bg-honey-light text-honey-dark", PAID: "bg-sage-light text-sage-dark", FAILED: "bg-red-100 text-red-800", CANCELLED: "bg-ink/5 text-ink-muted",
    REFUNDED: "bg-lavender-light text-lavender-dark", PARTIALLY_REFUNDED: "bg-lavender-light text-lavender-dark",
    APPROVED: "bg-sage-light text-sage-dark", REJECTED: "bg-red-100 text-red-800", CONFIRMED: "bg-sage-light text-sage-dark", UNSUBSCRIBED: "bg-ink/5 text-ink-muted",
  };
  const labels: Record<string, string> = {
    DRAFT: "Brouillon", SCHEDULED: "Programmé", PUBLISHED: "Publié", ARCHIVED: "Archivé", PENDING: "En attente", PAID: "Payée", FAILED: "Échouée", CANCELLED: "Annulée",
    REFUNDED: "Remboursée", PARTIALLY_REFUNDED: "Remb. partiel", APPROVED: "Approuvé", REJECTED: "Rejeté", CONFIRMED: "Confirmé", UNSUBSCRIBED: "Désinscrit",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", map[status] ?? "bg-ink/10")}>{labels[status] ?? status}</span>;
}
