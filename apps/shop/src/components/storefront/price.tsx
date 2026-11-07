import { cn, formatPrice } from "@/lib/utils";

export function Price({ priceCents, compareAtCents, currency = "EUR", size = "md", className }: { priceCents: number; compareAtCents?: number | null; currency?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "text-base", md: "text-xl", lg: "text-2xl", xl: "text-4xl" }[size];
  return (
    <span className={cn("inline-flex items-baseline gap-2 font-heading font-bold", className)}>
      <span className={cn(sizes, compareAtCents ? "text-coral-dark" : "text-ink")}>{formatPrice(priceCents, currency)}</span>
      {compareAtCents != null && compareAtCents > priceCents && (
        <span className="text-sm font-semibold text-ink-muted line-through">{formatPrice(compareAtCents, currency)}</span>
      )}
    </span>
  );
}
