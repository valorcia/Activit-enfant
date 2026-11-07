import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, description, href, linkLabel, align = "left", className, as: Tag = "h2" }: { eyebrow?: string; title: string; description?: string; href?: string; linkLabel?: string; align?: "left" | "center"; className?: string; as?: "h1" | "h2" | "h3" }) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", align === "center" && "sm:flex-col sm:items-center sm:text-center", className)}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className="mb-2 inline-block rounded-full bg-honey-light px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider text-honey-dark">{eyebrow}</p>}
        <Tag className="font-heading text-3xl font-bold leading-tight text-balance sm:text-4xl">{title}</Tag>
        {description && <p className="mt-2 text-base text-ink-soft text-pretty sm:text-lg">{description}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-heading font-bold text-coral-dark transition-colors hover:bg-white hover:text-coral">
          {linkLabel ?? "Tout voir"} <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
