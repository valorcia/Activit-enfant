"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyField({ value, label = "Copier", multiline = false }: { value: string; label?: string; multiline?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignoré */ } };
  return (
    <div className="flex items-start gap-2">
      {multiline ? <pre className="flex-1 whitespace-pre-wrap break-words rounded-xl bg-cream p-3 text-xs leading-relaxed max-h-80 overflow-auto">{value}</pre> : <code className="flex-1 truncate rounded-xl bg-cream px-3 py-2 text-xs">{value}</code>}
      <Button type="button" size="sm" variant="outline" onClick={copy}>{done ? <Check className="size-4" /> : <Copy className="size-4" />} {done ? "Copié" : label}</Button>
    </div>
  );
}
