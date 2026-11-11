"use client";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Textarea } from "@/components/ui/input";
import { refreshSitesAction, saveUniverseSettingsAction } from "@/app/actions/settings";
import { PRESETS, UNIVERSE_PRESETS, charterFor } from "@/lib/universes/presets";
import { groupByAudience, SITE_STATUS_LABELS, type SitesResult } from "@/lib/universes/sites";
import { typesForPreset } from "@/lib/kits/types";
import { UniverseSelect } from "@/components/universes/universe-select";
import { COLORING_CHARTER_KEY, DEFAULT_COLORING_CHARTER, coloringCharterFor } from "@/lib/kits/coloring";

/** Paramètres « Univers » : liste lue dans la boutique, univers par défaut, charte d'illustration par préréglage. */
export function UniverseSettingsForm({ initial, defaultSiteSlug, charters, legacyCharter }: { initial: SitesResult; defaultSiteSlug: string | null; charters: Record<string, string>; legacyCharter: string }) {
  const [result, setResult] = useState(initial);
  const [def, setDef] = useState<string | null>(defaultSiteSlug);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(UNIVERSE_PRESETS.map((p) => [p, charterFor(p, charters, legacyCharter)])));
  const [coloring, setColoring] = useState(() => coloringCharterFor(charters));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const used = new Set(result.sites.map((s) => s.preset));

  const refresh = () => start(async () => { setError(null); try { setResult(await refreshSitesAction()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } });
  const save = () =>
    start(async () => {
      setError(null);
      try {
        // On n'enregistre que les chartes différentes de la charte intégrée du préréglage.
        const overrides: Record<string, string> = Object.fromEntries(Object.entries(values).filter(([p, v]) => v.trim() && v.trim() !== PRESETS[p as keyof typeof PRESETS].charter));
        if (coloring.trim() && coloring.trim() !== DEFAULT_COLORING_CHARTER) overrides[COLORING_CHARTER_KEY] = coloring.trim();
        await saveUniverseSettingsAction({ defaultSiteSlug: def, illustrationCharters: overrides });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

  return (
    <div id="univers" className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Univers</h2>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={pending}><RefreshCw className="h-4 w-4" /> Actualiser</Button>
      </div>
      <p className="text-sm text-slate-500">
        Plateforme → audiences → univers : chaque univers de la boutique a son préréglage (ton éditorial, charte d&apos;illustration, thème PDF, types d&apos;e-books autorisés).
        {result.source === "fallback" && <> <span className="font-semibold text-amber-800">{result.error ?? "Boutique non reliée"} : univers par défaut « {result.sites[0]?.name} ».</span></>}
      </p>
      <div className="space-y-3">
        {groupByAudience(result.sites).map((g) => (
          <div key={g.audience}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.audience}</div>
            <ul className="grid gap-2">
              {g.sites.map((s) => (
                <li key={s.slug} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-semibold">{s.name}</span>
                  <Badge variant={s.status === "ACTIVE" ? "success" : s.status === "TEST" ? "warning" : "secondary"}>{SITE_STATUS_LABELS[s.status]}</Badge>
                  <Badge variant="secondary">{PRESETS[s.preset].label}</Badge>
                  <span className="text-xs text-slate-500">{s.primaryDomain ?? s.url ?? s.slug}</span>
                  <span className="text-xs text-slate-400">· {s.categories.length} catégorie(s) · types : {typesForPreset(s.preset).filter((k) => k.family === "kit").map((k) => k.label).join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Field label="Univers par défaut" hint="Présélectionné dans « Nouvel e-book » et utilisé si un brief ne permet pas de choisir.">
        <UniverseSelect sites={result.sites.filter((s) => s.status !== "ARCHIVED")} value={def ?? result.sites[0]?.slug ?? null} onChange={setDef} />
      </Field>
      <div className="space-y-3">
        <div className="text-sm font-semibold">Charte d&apos;illustration par préréglage</div>
        {UNIVERSE_PRESETS.map((p) => (
          <Field key={p} label={`${PRESETS[p].label}${used.has(p) ? "" : " (aucun univers actif)"}`} hint="Ajoutée en tête de tous les prompts d'images des e-books de cet univers.">
            <Textarea rows={4} value={values[p]} onChange={(e) => setValues({ ...values, [p]: e.target.value })} />
            <button type="button" className="mt-1 text-xs text-blue-700 hover:underline" onClick={() => setValues({ ...values, [p]: PRESETS[p].charter })}>Rétablir la charte par défaut</button>
          </Field>
        ))}
        <Field label="Coloriage (dessins à colorier, tous univers)" hint="Remplace la charte de l'univers pour les dessins des cahiers de coloriage (la couverture et les visuels restent en couleur).">
          <Textarea rows={4} value={coloring} onChange={(e) => setColoring(e.target.value)} />
          <button type="button" className="mt-1 text-xs text-blue-700 hover:underline" onClick={() => setColoring(DEFAULT_COLORING_CHARTER)}>Rétablir la charte par défaut</button>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={pending} onClick={save}>Enregistrer</Button>
        {saved && <span className="text-sm text-emerald-700">Enregistré</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
}
