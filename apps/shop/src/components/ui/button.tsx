import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-heading font-semibold transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:ring-4 focus-visible:ring-sky/50 focus-visible:outline-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-coral text-white shadow-[0_6px_0_0_color-mix(in_oklab,var(--brand-coral)_70%,black)] hover:brightness-105 hover:-translate-y-0.5 hover:shadow-[0_8px_0_0_color-mix(in_oklab,var(--brand-coral)_70%,black)] active:translate-y-0.5 active:shadow-[0_2px_0_0_color-mix(in_oklab,var(--brand-coral)_70%,black)]",
        secondary: "bg-honey text-ink shadow-[0_6px_0_0_color-mix(in_oklab,var(--brand-honey)_70%,#8a5a00)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_0_color-mix(in_oklab,var(--brand-honey)_70%,#8a5a00)]",
        outline: "border-2 border-ink/15 bg-white/70 text-ink hover:border-ink/40 hover:bg-white",
        ghost: "text-ink hover:bg-ink/5",
        soft: "bg-ink/5 text-ink hover:bg-ink/10",
        sky: "bg-sky text-ink hover:brightness-105",
        sage: "bg-sage text-ink hover:brightness-105",
        lavender: "bg-lavender text-ink hover:brightness-105",
        danger: "bg-red-500 text-white hover:bg-red-600",
        link: "text-coral-dark underline-offset-4 hover:underline",
        admin: "bg-ink text-white hover:bg-ink/90",
      },
      size: {
        sm: "h-9 px-4 text-sm rounded-[var(--radius-button)]",
        md: "h-11 px-6 text-base rounded-[var(--radius-button)]",
        lg: "h-14 px-8 text-lg rounded-[var(--radius-button)]",
        xl: "h-16 px-10 text-xl rounded-[var(--radius-button)]",
        icon: "size-10 rounded-full",
        "icon-sm": "size-8 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
