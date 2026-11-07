"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SelectOption { value: string; label: string; hint?: string }

/** Multi-sélection avec recherche côté client sur une liste fournie. */
export function SearchSelect({ options, value, onChange, placeholder = "Rechercher…", max, className }: { options: SelectOption[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; className?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = value.map((v) => options.find((o) => o.value === v)).filter(Boolean) as SelectOption[];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return options.filter((o) => !value.includes(o.value) && (!needle || o.label.toLowerCase().includes(needle) || o.hint?.toLowerCase().includes(needle))).slice(0, 20);
  }, [options, value, q]);
  return (
    <div className={cn("space-y-2", className)}>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((o) => (
            <li key={o.value} className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1 text-xs font-bold">
              {o.label}
              <button type="button" aria-label={`Retirer ${o.label}`} className="rounded-full p-0.5 hover:bg-ink/10" onClick={() => onChange(value.filter((v) => v !== o.value))}><X className="size-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder} className="h-10" disabled={max != null && value.length >= max} />
        {open && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-lift">
            {filtered.map((o) => (
              <li key={o.value}>
                <button type="button" className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm hover:bg-ink/5" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange([...value, o.value]); setQ(""); }}>
                  <span className="font-semibold">{o.label}</span>
                  {o.hint && <span className="text-xs text-ink-muted">{o.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
