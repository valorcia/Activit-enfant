"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { saveSettingsAction } from "@/app/actions/settings";
import { TEXT_MODELS, IMAGE_MODELS } from "@/lib/ai/pricing";
import type { AiSettings } from "@/lib/schemas/settings";

export function SettingsForm({ initial, availability }: { initial: AiSettings; availability: { anthropic: boolean; openai: boolean } }) {
  const [s, setS] = useState<AiSettings>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof AiSettings>(k: K, v: AiSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const textModels = TEXT_MODELS[s.textProvider] ?? [];
  const imageModels = IMAGE_MODELS[s.imageProvider] ?? [];
  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveSettingsAction(s);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        });
      }}
    >
      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Fournisseur de génération de texte" hint={s.textProvider !== "mock" && !availability[s.textProvider] ? "Clé API absente côté serveur : les générations échoueront." : undefined}>
          <Select value={s.textProvider} onChange={(e) => { const p = e.target.value as AiSettings["textProvider"]; set("textProvider", p); set("textModel", TEXT_MODELS[p]?.[0]?.value ?? ""); }}>
            <option value="anthropic">Anthropic (Claude) {availability.anthropic ? "— clé détectée" : "— clé absente"}</option>
            <option value="openai">OpenAI {availability.openai ? "— clé détectée" : "— clé absente"}</option>
            <option value="mock">Démonstration hors ligne (sans IA)</option>
          </Select>
        </Field>
        <Field label="Modèle texte">
          <Select value={s.textModel} onChange={(e) => set("textModel", e.target.value)}>
            {textModels.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Field>
        <Field label="Fournisseur de génération d'images" hint={s.imageProvider === "mock" ? "Les images produites sont des placeholders clairement étiquetés « DÉMO », jamais des illustrations définitives." : !availability.openai ? "Clé OPENAI_API_KEY absente côté serveur." : undefined}>
          <Select value={s.imageProvider} onChange={(e) => { const p = e.target.value as AiSettings["imageProvider"]; set("imageProvider", p); set("imageModel", IMAGE_MODELS[p]?.[0]?.value ?? ""); }}>
            <option value="openai">OpenAI (GPT Image) {availability.openai ? "— clé détectée" : "— clé absente"}</option>
            <option value="mock">Images de démonstration (étiquetées)</option>
          </Select>
        </Field>
        <Field label="Modèle image">
          <Select value={s.imageModel} onChange={(e) => set("imageModel", e.target.value)}>
            {imageModels.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Field>
        <Field label="Qualité des images">
          <Select value={s.imageQuality} onChange={(e) => set("imageQuality", e.target.value as AiSettings["imageQuality"])}>
            <option value="low">Basse (aperçus)</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute (impression)</option>
          </Select>
        </Field>
        <Field label="Taille des images">
          <Select value={s.imageSize} onChange={(e) => set("imageSize", e.target.value as AiSettings["imageSize"])}>
            <option value="1024x1024">1024 × 1024 (carré)</option>
            <option value="1536x1024">1536 × 1024 (paysage)</option>
            <option value="1024x1536">1024 × 1536 (portrait)</option>
          </Select>
        </Field>
        <Field label="Illustrations d'étapes">
          <Select value={s.stepIllustrations ? "1" : "0"} onChange={(e) => set("stepIllustrations", e.target.value === "1")}>
            <option value="1">Oui : une illustration par étape</option>
            <option value="0">Non : illustration finale uniquement</option>
          </Select>
        </Field>
        <Field label="Nombre maximal d'illustrations d'étapes par activité">
          <Input type="number" min={0} max={15} value={s.maxStepIllustrations} onChange={(e) => set("maxStepIllustrations", Number(e.target.value))} />
        </Field>
        <Field label="Budget maximal par livre (USD)" hint="Le pipeline s'arrête quand les dépenses enregistrées du livre dépassent ce montant.">
          <Input type="number" min={0} step="0.5" value={s.maxBudgetPerBookUsd} onChange={(e) => set("maxBudgetPerBookUsd", Number(e.target.value))} />
        </Field>
        <Field label="Générations simultanées (worker)" hint="Pris en compte au redémarrage du worker.">
          <Input type="number" min={1} max={10} value={s.maxConcurrentGenerations} onChange={(e) => set("maxConcurrentGenerations", Number(e.target.value))} />
        </Field>
      </div>
      <div className="rounded-lg bg-slate-50 p-4 text-sm">
        <div className="font-semibold mb-1">Clés API (serveur uniquement)</div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant={availability.anthropic ? "success" : "secondary"}>ANTHROPIC_API_KEY {availability.anthropic ? "configurée" : "absente"}</Badge>
          <Badge variant={availability.openai ? "success" : "secondary"}>OPENAI_API_KEY {availability.openai ? "configurée" : "absente"}</Badge>
        </div>
        <p className="text-xs text-slate-500 mt-2">Définissez-les dans le fichier .env (local) ou dans les variables d'environnement de l'hébergeur. Elles ne transitent jamais par le navigateur.</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>Enregistrer</Button>
        {saved && <span className="text-sm text-emerald-700">Paramètres enregistrés.</span>}
      </div>
    </form>
  );
}
