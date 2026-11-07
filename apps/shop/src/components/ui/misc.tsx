import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn("border-0 h-px bg-line my-6", className)} {...props} />;
}

export function Alert({ variant = "info", title, children, className }: { variant?: "info" | "success" | "warning" | "danger"; title?: string; children?: React.ReactNode; className?: string }) {
  const styles = {
    info: "bg-sky-light border-sky text-sky-dark",
    success: "bg-sage-light border-sage text-sage-dark",
    warning: "bg-honey-light border-honey text-honey-dark",
    danger: "bg-red-50 border-red-200 text-red-800",
  }[variant];
  return (
    <div role="alert" className={cn("rounded-2xl border px-4 py-3 text-sm", styles, className)}>
      {title && <p className="font-bold mb-1">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center rounded-3xl border-2 border-dashed border-line bg-white/50 px-6 py-14", className)}>
      {icon && <div className="mb-4 text-ink-muted [&_svg]:size-10">{icon}</div>}
      <h3 className="font-heading text-xl font-semibold">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Stars({ rating, size = "md", className }: { rating: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const px = size === "sm" ? 14 : size === "lg" ? 22 : 18;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} sur 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={px} height={px} viewBox="0 0 24 24" fill={i <= Math.round(rating) ? "var(--brand-honey)" : "none"} stroke={i <= Math.round(rating) ? "var(--brand-honey)" : "currentColor"} strokeWidth="1.8" className={i <= Math.round(rating) ? "" : "text-ink/25"}>
          <path d="M12 2.5l2.95 6.26 6.85.86-5.03 4.74 1.3 6.8L12 17.77l-6.07 3.39 1.3-6.8L2.2 9.62l6.85-.86L12 2.5z" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}
