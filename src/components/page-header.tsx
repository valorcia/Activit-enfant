import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        {description && <div className="text-sm text-slate-500 mt-1">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
