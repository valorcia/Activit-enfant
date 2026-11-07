import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function TrustBadges({ badges, className, compact = false }: { badges: Array<{ icon: string; label: string }>; className?: string; compact?: boolean }) {
  if (!badges.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-2 text-ink-soft", compact ? "text-xs" : "text-sm", className)} aria-label="Garanties">
      {badges.map((b) => (
        <li key={b.label} className="inline-flex items-center gap-1.5 font-semibold">
          <span className="grid size-6 place-items-center rounded-full bg-sage-light text-sage-dark"><Icon name={b.icon} className="size-3.5" /></span>
          {b.label}
        </li>
      ))}
    </ul>
  );
}
