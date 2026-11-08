"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Plug } from "lucide-react";
import { toggleManualModeAction } from "@/app/actions/manual";
import { cn } from "@/lib/utils";

/** Bascule rapide entre le mode API et le mode copier-coller (visible dans la barre latérale). */
export function ModeToggle({ mode: initial }: { mode: "api" | "manual" }) {
  const [mode, setMode] = useState(initial);
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const router = useRouter();
  const manual = mode === "manual";
  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        disabled={pending}
        aria-pressed={manual}
        title={manual ? "Repasser en mode API (clés requises)" : "Passer en mode copier-coller (sans clé API)"}
        onClick={() =>
          start(async () => {
            const r = await toggleManualModeAction();
            setMode(r.mode);
            setFlash(r.mode === "manual" ? "Mode copier-coller activé : les prompts apparaîtront dans « À coller »." : "Mode API activé.");
            setTimeout(() => setFlash(null), 3500);
            router.refresh();
          })
        }
        className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors", manual ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100", pending && "opacity-60")}
      >
        {manual ? <ClipboardPaste className="h-4 w-4 shrink-0" /> : <Plug className="h-4 w-4 shrink-0" />}
        <span className="flex-1">
          <span className="block">{manual ? "Mode copier-coller" : "Mode API"}</span>
          <span className="block text-[10px] font-normal opacity-80">{manual ? "Sans clé · cliquez pour repasser en API" : "Clés API · cliquez pour le copier-coller"}</span>
        </span>
        <span className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", manual ? "bg-amber-500" : "bg-slate-300")}>
          <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", manual ? "translate-x-4" : "translate-x-0.5")} />
        </span>
      </button>
      {flash && <p className="mt-1 px-1 text-[11px] text-slate-500">{flash}</p>}
    </div>
  );
}
