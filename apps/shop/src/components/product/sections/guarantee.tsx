import { Icon } from "@/components/ui/icon";
import { getSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** Bloc garantie (configurable Admin → Apparence → Conversion). Masqué si désactivé. */
export async function GuaranteeBlock({ siteId, compact = false, className }: { siteId?: string; compact?: boolean; className?: string }) {
  const { guarantee } = await getSetting("conversion", siteId);
  if (!guarantee.enabled) return null;
  if (compact) {
    return (
      <p className={cn("flex items-start gap-2 rounded-2xl bg-sage-light px-4 py-3 text-sm text-sage-dark", className)}>
        <Icon name={guarantee.icon} className="mt-0.5 size-4 shrink-0" />
        <span><strong>{guarantee.title}.</strong> {guarantee.text}</span>
      </p>
    );
  }
  return (
    <section className={cn("py-6 sm:py-8", className)} aria-labelledby="guarantee-title">
      <div className="container-shell">
        <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border-2 border-dashed border-sage bg-sage-light/60 p-6 text-center sm:flex-row sm:text-left sm:p-8">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white text-sage-dark shadow-card"><Icon name={guarantee.icon} className="size-8" /></span>
          <div>
            <h2 id="guarantee-title" className="font-heading text-2xl font-bold">{guarantee.title}</h2>
            <p className="mt-1 text-ink-soft">{guarantee.text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
