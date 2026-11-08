"use client";
import { useRef, useState, useTransition } from "react";
import { Check, Film, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { saveVideoSettingsAction, uploadMusicAction } from "@/app/actions/videos";
import type { VideoSettingsPublic } from "@/lib/settings";

export function VideoSettingsForm({ initial }: { initial: VideoSettingsPublic }) {
  const [pending, start] = useTransition();
  const [key, setKey] = useState("");
  const [usdPerSecond, setUsd] = useState(initial.usdPerSecond);
  const [duration, setDuration] = useState(initial.defaultDurationSeconds);
  const [volume, setVolume] = useState(initial.musicVolume);
  const [music, setMusic] = useState<string | null>(initial.defaultMusicAssetId);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const musicRef = useRef<HTMLInputElement>(null);

  const save = (patch: Record<string, unknown> = {}) =>
    start(async () => {
      const r = await saveVideoSettingsAction({ runwayApiKey: key.trim(), usdPerSecond, defaultDurationSeconds: duration, musicVolume: volume, defaultMusicAssetId: music, ...patch });
      setMessage(r.ok ? { ok: true, text: "Réglages vidéo enregistrés." } : { ok: false, text: r.error });
      if (r.ok) setKey("");
    });

  return (
    <section id="video" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold"><Film className="h-4 w-4 text-rose-600" /> Vidéo</h2>
      <p className="mb-4 text-sm text-slate-500">Vidéos publicitaires : montage Remotion (gratuit, réalisé par le worker) et clip d&apos;accroche animé par Runway. Sans clé, le mode copier-coller reste disponible.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Clé API Runway" hint={initial.runwayConfigured ? `Configurée (${initial.runwayKeyPreview}). Laisser vide pour la conserver.` : "dev.runwayml.com → API keys. Stockée côté serveur, jamais renvoyée au navigateur."}>
          <Input type="password" autoComplete="off" value={key} placeholder={initial.runwayConfigured ? "••••••••" : "key_…"} onChange={(e) => setKey(e.target.value)} />
        </Field>
        <Field label="Coût Runway estimé ($ par seconde)" hint="Gen-4 Turbo : ≈ 5 crédits/s × 0,01 $ = 0,05 $/s. À ajuster selon votre offre.">
          <Input type="number" step="0.01" min={0} max={5} value={usdPerSecond} onChange={(e) => setUsd(Number(e.target.value))} />
        </Field>
        <Field label={`Durée par défaut : ${duration} s`}><input type="range" min={6} max={20} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-3 w-full accent-rose-600" /></Field>
        <Field label={`Volume de la musique : ${Math.round(volume * 100)} %`}><input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-3 w-full accent-rose-600" /></Field>
        <Field label="Musique par défaut" hint="Fichier libre de droits (MP3, M4A), utilisé si aucune musique n'est choisie pour une vidéo.">
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => musicRef.current?.click()}><Music className="h-3.5 w-3.5" /> {music ? "Remplacer" : "Téléverser"}</Button>
            {music && <><a className="text-xs text-blue-700 hover:underline" href={`/api/assets/${music}`} target="_blank" rel="noreferrer">Écouter</a><Button type="button" size="sm" variant="ghost" onClick={() => { setMusic(null); save({ defaultMusicAssetId: null }); }}>Retirer</Button></>}
            <input ref={musicRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; start(async () => { const fd = new FormData(); fd.set("file", f); fd.set("setDefault", "1"); const r = await uploadMusicAction(fd); if (r.ok) { setMusic(r.data.assetId); setMessage({ ok: true, text: `Musique par défaut : ${r.data.name}` }); } else setMessage({ ok: false, text: r.error }); }); }} />
          </div>
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => save()} disabled={pending}><Check className="h-4 w-4" /> Enregistrer</Button>
        {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
      </div>
    </section>
  );
}
