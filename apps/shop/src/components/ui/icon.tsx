import * as React from "react";
import * as icons from "lucide-react";
import { cn } from "@/lib/utils";

type IconName = string;

function toPascal(name: string): string {
  return name.split(/[-_\s]+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

/** Icône lucide par nom (kebab-case), configurable depuis l'admin. */
export function Icon({ name, className, ...props }: { name: IconName; className?: string } & React.SVGProps<SVGSVGElement>) {
  const key = toPascal(name) as keyof typeof icons;
  const Cmp = (icons[key] ?? icons.Sparkles) as React.ComponentType<React.SVGProps<SVGSVGElement>>;
  return <Cmp className={cn("size-5", className)} aria-hidden {...props} />;
}
