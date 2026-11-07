"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField({ label, htmlFor, hint, error, children, className, required }: { label: string; htmlFor?: string; hint?: string; error?: string | string[] | null; children: React.ReactNode; className?: string; required?: boolean }) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}{required && <span className="text-coral"> *</span>}</Label>
      {children}
      {hint && !err && <p className="text-xs text-ink-muted">{hint}</p>}
      {err && <p className="text-xs font-semibold text-red-600" role="alert">{err}</p>}
    </div>
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-sm", className)}>
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      {description && <p className="mb-4 text-sm text-ink-soft">{description}</p>}
      <div className={cn("grid gap-4", !description && "mt-4")}>{children}</div>
    </section>
  );
}

/** Éditeur de liste générique (contenu du kit, FAQ, arguments…) avec ajout, suppression, réordonnancement. */
export function ListEditor<T>({ items, onChange, renderItem, create, addLabel = "Ajouter", itemLabel = (i: number) => `Élément ${i + 1}` }: { items: T[]; onChange: (items: T[]) => void; renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode; create: () => T; addLabel?: string; itemLabel?: (index: number) => string }) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-line bg-[#FBFAF7] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{itemLabel(i)}</span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Monter" onClick={() => move(i, i - 1)} disabled={i === 0}><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Descendre" onClick={() => move(i, i + 1)} disabled={i === items.length - 1}><ArrowDown className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Supprimer" className="text-red-600" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
            </div>
          </div>
          {renderItem(item, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))), i)}
        </div>
      ))}
      <Button type="button" variant="soft" size="sm" onClick={() => onChange([...items, create()])}><Plus className="size-4" /> {addLabel}</Button>
    </div>
  );
}

export { eurosToCents, centsToEuros, toLocalInput } from "@/lib/admin/form-utils";
