"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Film, Music, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createAdVideosAction, uploadMusicAction } from "@/app/actions/videos";
import { AD_FORMAT_LABELS, AD_FORMATS, type AdFormOptions } from "@/lib/video/props";

export interface VideoFormDefaults {
  form: AdFormOptions;
  universe?: string;
  choices: Array<{ assetId: string; label: string; src: string }>;
  prompts: Record<string, string>;
  runwayConfigured: boolean;
  usdPerSecond: number;
  defaultMusicAssetId: string | null;
  allowMock: boolean;
}

type ClipMode = "none" | "runway" | "manual" | "mock";
type Format = (typeof AD_FORMATS)[number];

export function VideoForm({ bookId, defaults }: { bookId: string; defaults: VideoFormDefaults }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [formats, setFormats] = useState<Format[]>(["story"]);
  const [duration, setDuration] = useState(defaults.form.durationSeconds);
  const [hook, setHook] = useState(defaults.form.hook);
  const [bullets, setBullets] = useState<string[]>([...defaults.form.bullets, "", ""].slice(0, 3));
  const [cta, setCta] = useState(defaults.form.cta);
  const [clipMode, setClipMode] = useState<ClipMode>("none");
  const [source, setSource] = useState<string | null>(defaults.choices[0]?.assetId ?? null);
  const [clipDuration, setClipDuration] = useState<5 | 10>(5);
  const [prompt, setPrompt] = useState(source ? defaults.prompts[source] ?? "" : "");
  const [musicAssetId, setMusicAssetId] = useState<string | null>(defaults.defaultMusicAssetId);
  const [musicName, setMusicName] = useState<string | null>(defaults.defaultMusicAssetId ? "Musique par défaut" : null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const musicRef = useRef<HTMLInputElement>(null);

  const clipCost = useMemo(() => (clipMode === "runway" ? clipDuration * defaults.usdPerSecond * formats.length : 0), [clipMode, clipDuration, defaults.usdPerSecond, formats.length]);
  const toggleFormat = (f: Format) => setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  const pickSource = (id: string) => {
    setSource(id);
    setPrompt(defaults.prompts[id] ?? prompt);
  };

  const submit = () =>
    start(async () => {
      setError(null);
      setInfo(null);
      const r = await createAdVideosAction(bookId, {
        formats,
        durationSeconds: duration,
        hook,
        bullets: bullets.map((b) => b.trim()).filter(Boolean),
        cta,
        clipProvider: clipMode,
        clipSourceAssetId: clipMode === "none" ? null : source,
        clipPrompt: clipMode === "none" ? null : prompt,
        clipDurationSeconds: clipDuration,
        musicAssetId,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setInfo(
        clipMode === "manual"
          ? `${r.data.count} vidéo(s) créée(s). Produisez le clip dans Runway ou Sora puis téléversez-le dans « À coller » : le montage reprendra automatiquement.`
          : `${r.data.count} vidéo(s) en file. Le worker du studio doit être lancé (pnpm worker) pour le montage.`,
      );
      router.refresh();
    });

  const uploadMusic = (file: File) =>
    start(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const r = await uploadMusicAction(fd);
      if (r.ok) {
        setMusicAssetId(r.data.assetId);
        setMusicName(r.data.name);
      } else setError(r.error);
    });

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 font-bold"><Film className="h-4 w-4 text-rose-600" /> Nouvelle vidéo publicitaire</div>

      <Field label="Formats">
        <div className="flex flex-wrap gap-2">
          {AD_FORMATS.map((f) => (
            <button key={f} type="button" onClick={() => toggleFormat(f)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${formats.includes(f) ? "border-rose-500 bg-rose-50 text-rose-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`} aria-pressed={formats.includes(f)}>
              {AD_FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 md:grid-cols-[1fr_160px]">
        <Field label="Accroche (scène 1)" hint="90 caractères maximum, affichée en gros sur l'illustration."><Input value={hook} maxLength={90} onChange={(e) => setHook(e.target.value)} /></Field>
        <Field label={`Durée : ${duration} s`}><input type="range" min={6} max={20} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-3 w-full accent-rose-600" /></Field>
      </div>

      <Field label="Bénéfices (scène 3)" hint="2 ou 3 phrases courtes, préremplies depuis la fiche boutique.">
        <div className="space-y-2">
          {bullets.map((b, i) => <Input key={i} value={b} maxLength={70} placeholder={`Bénéfice ${i + 1}`} onChange={(e) => setBullets((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} />)}
        </div>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Appel à l'action (scène 4)"><Input value={cta} maxLength={40} onChange={(e) => setCta(e.target.value)} /></Field>
        <Field label="Musique (facultatif)" hint="MP3/M4A libre de droits, fondu automatique.">
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => musicRef.current?.click()}><Music className="h-3.5 w-3.5" /> {musicName ? "Changer" : "Téléverser"}</Button>
            {musicName && <span className="truncate text-xs text-slate-600">{musicName}</span>}
            {musicAssetId && <Button type="button" size="sm" variant="ghost" onClick={() => { setMusicAssetId(null); setMusicName(null); }}>Sans musique</Button>}
            <input ref={musicRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMusic(f); }} />
          </div>
        </Field>
      </div>

      <Field label="Clip d'accroche animé (scène 1)">
        <div className="flex flex-wrap gap-2">
          {([
            ["none", "Aucun (illustration fixe animée)"],
            ["runway", defaults.runwayConfigured ? "Runway (automatique)" : "Runway (clé manquante)"],
            ["manual", "Copier-coller (Runway, Sora, Veo)"],
            ...(defaults.allowMock ? [["mock", "Démo (développement)"]] : []),
          ] as Array<[ClipMode, string]>).map(([m, label]) => (
            <button key={m} type="button" disabled={m === "runway" && !defaults.runwayConfigured} onClick={() => setClipMode(m)} className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${clipMode === m ? "border-violet-500 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
      </Field>

      {clipMode !== "none" && (
        <div className="space-y-4 rounded-lg bg-slate-50 p-4">
          {defaults.choices.length === 0 ? (
            <p className="text-sm text-amber-800">Aucune illustration disponible : générez ou importez au moins la couverture du livre.</p>
          ) : (
            <Field label="Illustration à animer">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {defaults.choices.map((c) => (
                  <button key={c.assetId} type="button" onClick={() => pickSource(c.assetId)} className={`shrink-0 overflow-hidden rounded-lg border-2 ${source === c.assetId ? "border-violet-500" : "border-transparent"}`} title={c.label}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.src} alt={c.label} className="h-20 w-20 object-cover" />
                    <span className="block max-w-20 truncate bg-white px-1 text-[10px] text-slate-600">{c.label}</span>
                  </button>
                ))}
              </div>
            </Field>
          )}
          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <Field label="Prompt de mouvement (anglais)" hint="Prérempli : style aquarelle conservé, mouvements doux, aucun texte ajouté.">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[90px] text-xs" />
            </Field>
            <Field label="Durée du clip">
              <div className="flex gap-2">
                {([5, 10] as const).map((d) => <button key={d} type="button" onClick={() => setClipDuration(d)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${clipDuration === d ? "border-violet-500 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-600"}`}>{d} s</button>)}
              </div>
            </Field>
          </div>
          {clipMode === "runway" && <p className="text-sm text-slate-700">Coût estimé : <strong>{clipCost.toFixed(2)} $</strong> ({formats.length} clip{formats.length > 1 ? "s" : ""} de {clipDuration} s à {defaults.usdPerSecond.toFixed(2)} $/s).</p>}
          {clipMode === "manual" && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button type="button" size="sm" onClick={async () => { await navigator.clipboard.writeText(prompt).catch(() => undefined); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copié !" : "Copier le prompt"}</Button>
              <Button asChild size="sm" variant="secondary"><a href="https://app.runwayml.com/" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir Runway</a></Button>
              <span className="text-slate-600">Image vers vidéo, {clipDuration} s, puis téléversez le MP4 dans « À coller ».</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending || formats.length === 0 || !hook.trim() || (clipMode !== "none" && !source)}>
          {pending ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Wand2 className="h-4 w-4" />} Générer {formats.length > 1 ? `${formats.length} vidéos` : "la vidéo"}
        </Button>
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {info && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
      </div>
    </div>
  );
}
