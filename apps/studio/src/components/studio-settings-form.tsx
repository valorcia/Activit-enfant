"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { saveStudioSettingsAction } from "@/app/actions/settings";
import type { StudioSettings } from "@/lib/schemas/settings";
import { KIT_TYPES } from "@/lib/kits/types";

/** Paramètres du studio : nom affiché, auteur, prix par défaut par type d'e-book. */
export function StudioSettingsForm({ initial }: { initial: StudioSettings }) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const kits = KIT_TYPES.filter((k) => k.family === "kit" || ["cahier-activites", "jeux-logique", "activites-montessori", "histoire-illustree", "histoire-du-soir", "livre-personnalisable"].includes(k.key));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="font-bold">Studio</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom du studio affiché" hint="Ex. « La Malle à Jeux · Studio » (le texte après « · » apparaît en sous-titre)."><Input value={s.studioName} onChange={(e) => setS({ ...s, studioName: e.target.value })} /></Field>
        <Field label="Auteur / collection par défaut"><Input value={s.defaultAuthor} onChange={(e) => setS({ ...s, defaultAuthor: e.target.value })} /></Field>
      </div>
      <p className="text-xs text-slate-500">Les chartes d&apos;illustration se règlent par préréglage d&apos;univers, dans la section « Univers » ci-dessous.</p>
      <div>
        <div className="mb-2 text-sm font-semibold">Prix par défaut par type d&apos;e-book (€ TTC)</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((k) => (
            <label key={k.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span>{k.label}</span>
              <Input className="w-24" type="number" min={0} step={0.1} value={((s.priceByKitType[k.key] ?? k.defaultPriceCents) / 100).toFixed(2)} onChange={(e) => setS({ ...s, priceByKitType: { ...s.priceByKitType, [k.key]: Math.round(Number(e.target.value) * 100) } })} />
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={pending} onClick={() => start(async () => { setError(null); try { await saveStudioSettingsAction({ studioName: s.studioName, defaultAuthor: s.defaultAuthor, priceByKitType: s.priceByKitType }); setSaved(true); setTimeout(() => setSaved(false), 2000); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } })}>Enregistrer</Button>
        {saved && <span className="text-sm text-emerald-700">Enregistré</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
}
