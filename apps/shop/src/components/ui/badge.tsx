import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold font-heading leading-none whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        coral: "bg-coral text-white",
        honey: "bg-honey text-ink",
        sage: "bg-sage text-ink",
        sky: "bg-sky text-ink",
        lavender: "bg-lavender text-ink",
        ink: "bg-ink text-white",
        outline: "border border-ink/20 text-ink bg-white/70",
        soft: "bg-ink/5 text-ink-soft",
        success: "bg-emerald-100 text-emerald-800",
        warning: "bg-amber-100 text-amber-800",
        danger: "bg-red-100 text-red-800",
        info: "bg-blue-100 text-blue-800",
      },
      size: { sm: "px-2 py-0.5 text-[10px]", md: "", lg: "px-4 py-1.5 text-sm" },
    },
    defaultVariants: { variant: "honey", size: "md" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };
