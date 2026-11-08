"use client";
import { useState, useTransition } from "react";
import { Check, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { saveAutopilotSettingsAction } from "@/app/actions/autopilot";
import type { AutopilotSettings } from "@/lib/schemas/settings";

const STAGES: Array<[keyof AutopilotSettings["stages"], string]> = [
  ["quality", "Contrôles qualité"],
  ["character", "Planche de personnages (référence des illustrations)"],
  ["pdf", "Export PDF"],
  ["publish", "Publication dans la boutique"],
  ["video", "Vidéos publicitaires"],
  ["ads", "Campagne et posts publicitaires"],
];
const FORMATS: Array<[AutopilotSettings["videoFormats"][number], string]> = [["story", "Story 9:16"], ["square", "Carré 1:1"], ["landscape", "Paysage 16:9"]];
const CHANNELS: Array<[AutopilotSettings["channels"][number], string]> = [["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"]];

function Check2({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function AutopilotSettingsForm({ initial, allowMock }: { initial: AutopilotSettings; allowMock: boolean }) {
  const [s, setS] = useState<AutopilotSettings>(initial);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof AutopilotSettings>(k: K, v: AutopilotSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const toggleIn = <T,>(list: T[], v: T, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

  const save = () =>
    start(async () => {
      const r = await saveAutopilotSettingsAction(s);
      setMessage(r.ok ? { ok: true, text: "Réglages du pilote automatique enregistrés." } : { ok: false, text: r.error });
    });

  return (
    <section id="autopilot" className="rounded-xl border border-emerald-200 bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold"><Rocket className="h-4 w-4 text-emerald-600" /> Pilote automatique</h2>
      <p className="mb-4 text-sm text-slate-500">Du brief à la campagne : ces réglages s&apos;appliquent à chaque nouveau lancement (« Tout lancer en automatique »).</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Étapes</h3>
          <p className="text-xs text-slate-500">Plan, rédaction, illustrations et mise en page sont toujours faits.</p>
          {STAGES.map(([k, label]) => <Check2 key={k} label={label} checked={s.stages[k] !== false} onChange={(v) => set("stages", { ...s.stages, [k]: v })} />)}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Points de validation</h3>
          <p className="text-xs text-slate-500">Le run s&apos;arrête et attend « Valider et continuer ».</p>
          <Check2 label="Après la rédaction" checked={s.approvals.afterContent} onChange={(v) => set("approvals", { ...s.approvals, afterContent: v })} />
          <Check2 label="Après les illustrations" checked={s.approvals.afterIllustrations} onChange={(v) => set("approvals", { ...s.approvals, afterIllustrations: v })} />
          <Check2 label="Avant la publication en boutique" checked={s.approvals.beforePublish} onChange={(v) => set("approvals", { ...s.approvals, beforePublish: v })} />
          <Field label="Avant les publicités">
            <Select value={s.approvals.beforeAds === null ? "auto" : s.approvals.beforeAds ? "yes" : "no"} onChange={(e) => set("approvals", { ...s.approvals, beforeAds: e.target.value === "auto" ? null : e.target.value === "yes" })}>
              <option value="auto">Automatique (seulement si les posts sont programmés)</option>
              <option value="yes">Toujours</option>
              <option value="no">Jamais</option>
            </Select>
          </Field>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold">Boutique et PDF</h3>
          <Check2 label="Publier directement (sinon brouillon à valider dans la boutique)" checked={s.publishDirect} onChange={(v) => set("publishDirect", v)} />
          <Check2 label="Produire aussi la version imprimable du PDF" checked={s.printPdf} onChange={(v) => set("printPdf", v)} />
          <Field label="Plafond de coût par e-book ($)" hint="Au-delà, le run s'arrête pour validation. Le clip Runway est remplacé par le montage seul s'il dépasse le plafond.">
            <Input type="number" min={0} max={500} step={1} value={s.maxCostUsd} onChange={(e) => set("maxCostUsd", Number(e.target.value))} />
          </Field>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold">Vidéos</h3>
          <div className="flex flex-wrap gap-4">{FORMATS.map(([k, label]) => <Check2 key={k} label={label} checked={s.videoFormats.includes(k)} onChange={(v) => set("videoFormats", toggleIn(s.videoFormats, k, v).length ? toggleIn(s.videoFormats, k, v) : s.videoFormats)} />)}</div>
          <Field label={`Durée : ${s.videoDurationSeconds} s`}><input type="range" min={6} max={20} value={s.videoDurationSeconds} onChange={(e) => set("videoDurationSeconds", Number(e.target.value))} className="mt-2 w-full accent-emerald-600" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Clip d'accroche">
              <Select value={s.clipProvider} onChange={(e) => set("clipProvider", e.target.value as AutopilotSettings["clipProvider"])}>
                <option value="none">Aucun (montage seul, gratuit)</option>
                <option value="runway">Runway (payant)</option>
                <option value="manual">Copier-coller (à téléverser)</option>
                {allowMock && <option value="mock">Démonstration</option>}
              </Select>
            </Field>
            <Field label="Durée du clip">
              <Select value={s.clipDurationSeconds} onChange={(e) => set("clipDurationSeconds", Number(e.target.value) as 5 | 10)}>
                <option value={5}>5 s</option>
                <option value={10}>10 s</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="space-y-3 md:col-span-2">
          <h3 className="text-sm font-bold">Publicités</h3>
          <div className="flex flex-wrap gap-4">{CHANNELS.map(([k, label]) => <Check2 key={k} label={label} checked={s.channels.includes(k)} onChange={(v) => set("channels", toggleIn(s.channels, k, v))} />)}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Variantes par canal"><Select value={s.variantsPerChannel} onChange={(e) => set("variantsPerChannel", Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
            <Field label="Posts">
              <Select value={s.postsMode} onChange={(e) => set("postsMode", e.target.value as "draft" | "auto")}>
                <option value="draft">Brouillons à relire</option>
                <option value="auto">Programmation automatique</option>
              </Select>
            </Field>
            <Field label="Premier post après (h)"><Input type="number" min={0} max={720} value={s.postsStartOffsetHours} onChange={(e) => set("postsStartOffsetHours", Number(e.target.value))} /></Field>
            <Field label="Espacement (h)"><Input type="number" min={1} max={168} value={s.postsSpacingHours} onChange={(e) => set("postsSpacingHours", Number(e.target.value))} /></Field>
            <Field label="Budget pub / jour (€)" hint="Indicatif, transmis à la campagne"><Input type="number" min={0} step={1} value={s.dailyBudgetCents / 100} onChange={(e) => set("dailyBudgetCents", Math.round(Number(e.target.value) * 100))} /></Field>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={save} disabled={pending}><Check className="h-4 w-4" /> Enregistrer</Button>
        {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
      </div>
    </section>
  );
}
