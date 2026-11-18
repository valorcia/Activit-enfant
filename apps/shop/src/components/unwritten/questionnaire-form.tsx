"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { giftSaveStepAction, saveStepAction, type UwFormState } from "@/app/actions/unwritten";
import { currentUtm } from "@/lib/analytics/utm";
import type { DraftMode, Locale } from "@/lib/unwritten/constants";
import type { Dictionary } from "@/lib/unwritten/i18n/en";
import { defaultMaxLength, DEFAULT_MAX_PHOTOS, formatPhotoEntry, isAnswered, PHOTO_CAPTION_MAX, photoEntries, visibleSteps, type AnswerValue, type Answers, type Audience, type PhotoEntry } from "@/lib/unwritten/questionnaire/engine";
import type { Question, QuestionnaireDefinition } from "@/lib/unwritten/questionnaire/schema";

type L = { en: string; fr: string };
const tx = (t: L | undefined, locale: Locale) => (t ? t[locale] ?? t.en : "");

export interface QuestionnaireFormProps {
  variant: "draft" | "gift";
  locale: Locale;
  productSlug: string;
  token?: string;
  definition: QuestionnaireDefinition;
  stepId: string;
  stepNumber: number;
  totalSteps: number;
  answers: Answers;
  audience: Audience;
  mode: DraftMode;
  gift: { recipientName: string | null; recipientEmail: string | null; message: string | null };
  consentGiven: boolean;
  backHref: string | null;
  isLast: boolean;
  labels: Dictionary["questionnaire"];
  common: { optional: string };
  /** Édition choisie depuis la fiche produit (enregistrée avec le choix du répondant). */
  prefill?: { q: string; v: string } | null;
}

/** Identification pour les photos : brouillon de ce navigateur (produit) ou lien cadeau (jeton). */
type PhotoAuth = { product: string } | { token: string };

function Submit({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="uw-btn w-full sm:w-auto" disabled={pending}>
      {pending ? pendingLabel : label} {!pending && <span aria-hidden className="uw-arrow">→</span>}
    </button>
  );
}

export function QuestionnaireForm(props: QuestionnaireFormProps) {
  const { locale, labels, definition } = props;
  const [state, formAction] = useActionState<UwFormState | undefined, FormData>(props.variant === "gift" ? giftSaveStepAction : saveStepAction, undefined);
  const [values, setValues] = useState<Answers>(props.answers);
  const [mode, setMode] = useState<DraftMode>(props.mode);
  // UTM mémorisés côté navigateur (attribution) : écrits directement dans le champ caché
  const utmRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (utmRef.current) utmRef.current.value = JSON.stringify(currentUtm()); }, []);

  // Questions visibles de l'étape, recalculées à chaque saisie (conditions sur les questions précédentes)
  const questions = useMemo(() => {
    if (props.stepId === "mode") return [];
    return visibleSteps(definition, values, props.audience).find((s) => s.step.id === props.stepId)?.questions ?? [];
  }, [definition, values, props.audience, props.stepId]);
  const step = definition.steps.find((s) => s.id === props.stepId);
  const needsConsent = !props.consentGiven && questions.some((q) => q.sensitive);
  const set = (id: string, v: AnswerValue | undefined) => setValues((cur) => {
    const next = { ...cur };
    if (v === undefined || !isAnswered(v)) delete next[id];
    else next[id] = v;
    return next;
  });

  const progress = Math.round((props.stepNumber / Math.max(1, props.totalSteps)) * 100);
  const err = state?.errors ?? {};

  return (
    <form action={formAction} noValidate className="w-full">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="product" value={props.productSlug} />
      <input type="hidden" name="step" value={props.stepId} />
      <input type="hidden" name="utm" defaultValue="{}" ref={utmRef} />
      {props.token && <input type="hidden" name="token" value={props.token} />}
      {props.prefill && props.stepId === "mode" && <><input type="hidden" name="prefillQ" value={props.prefill.q} /><input type="hidden" name="prefillV" value={props.prefill.v} /></>}

      <div className="flex items-center justify-between gap-6">
        <p className="uw-eyebrow">{labels.stepOf.replace("{current}", String(props.stepNumber)).replace("{total}", String(props.totalSteps))}</p>
        {props.backHref && <Link href={props.backHref} className="text-sm text-[var(--uw-muted)] hover:text-[var(--uw-ink)]">← {labels.previous}</Link>}
      </div>
      <div className="uw-progress mt-4" aria-hidden><span style={{ width: `${progress}%` }} /></div>

      {props.stepId === "mode" ? (
        <fieldset className="mt-12">
          <legend className="uw-h2 !text-[clamp(2rem,6vw,2.9rem)]">{labels.modeTitle}</legend>
          <p className="uw-body mt-4">{labels.modeLead}</p>
          <div className="mt-9 grid gap-3">
            {(["self", "gift", "gift_recipient"] as const).map((m) => (
              <label key={m} className="uw-choice">
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
                <span className="uw-choice-dot" aria-hidden />
                <span>
                  <span className="uw-serif block text-[1.35rem] leading-tight">{labels.modes[m].title}</span>
                  <span className="uw-small mt-1 block">{labels.modes[m].text}</span>
                </span>
              </label>
            ))}
          </div>
          {mode !== "self" && (
            <div className="mt-10 grid gap-7">
              <Field label={labels.giftRecipientName} htmlFor="recipientName">
                <input id="recipientName" name="recipientName" className="uw-input" maxLength={40} defaultValue={props.gift.recipientName ?? ""} autoComplete="off" />
              </Field>
              {mode === "gift_recipient" && (
                <Field label={labels.giftRecipientEmail} htmlFor="recipientEmail" help={labels.giftRecipientEmailHelp} error={err.recipientEmail}>
                  <input id="recipientEmail" name="recipientEmail" type="email" inputMode="email" className="uw-input" maxLength={160} defaultValue={props.gift.recipientEmail ?? ""} autoComplete="off" aria-invalid={!!err.recipientEmail} />
                </Field>
              )}
              <Field label={labels.giftMessage} htmlFor="giftMessage">
                <textarea id="giftMessage" name="giftMessage" className="uw-input" maxLength={500} rows={3} defaultValue={props.gift.message ?? ""} />
              </Field>
            </div>
          )}
        </fieldset>
      ) : (
        <div className="mt-12">
          {step && <h1 className="uw-h2 !text-[clamp(2rem,6vw,2.9rem)]">{tx(step.title, locale)}</h1>}
          {step?.description && <p className="uw-body mt-4">{tx(step.description, locale)}</p>}
          <div className="mt-10 space-y-11">
            {questions.map((q) => <QuestionField key={q.id} q={q} locale={locale} value={values[q.id]} onChange={(v) => set(q.id, v)} error={err[q.id]} labels={labels} optional={props.common.optional} photoAuth={props.token ? { token: props.token } : { product: props.productSlug }} />)}
          </div>
          {needsConsent && (
            <div className="mt-11 border-t border-[var(--uw-line)] pt-7">
              <label className="uw-check">
                <input type="checkbox" name="consent" />
                <span>{labels.consentLabel}</span>
              </label>
            </div>
          )}
        </div>
      )}

      {state?.error && <p role="alert" className="uw-error mt-8 !text-[0.95rem]">{state.error}</p>}
      <div className="mt-12 flex flex-col gap-4 border-t border-[var(--uw-line)] pt-8 sm:flex-row sm:items-center sm:justify-between">
        <Submit label={props.isLast ? labels.finish : labels.next} pending={labels.saving} />
      </div>
    </form>
  );
}

function Field({ label, htmlFor, help, error, children, badge }: { label: string; htmlFor?: string; help?: string; error?: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="uw-label">{label}{badge && <span className="mt-2 block leading-none">{badge}</span>}</label>
      {help && <p className="uw-help">{help}</p>}
      <div className="mt-4">{children}</div>
      {error && <p className="uw-error" role="alert">{error}</p>}
    </div>
  );
}

function QuestionField({ q, locale, value, onChange, error, labels, optional, photoAuth }: { q: Question; locale: Locale; value: AnswerValue | undefined; onChange: (v: AnswerValue | undefined) => void; error?: string; labels: Dictionary["questionnaire"]; optional: string; photoAuth: PhotoAuth }) {
  const name = `a:${q.id}`;
  const label = tx(q.label, locale);
  const help = tx(q.help, locale) || undefined;
  if (q.type === "info") {
    return <p className="border-l border-[var(--uw-champagne)] py-1 pl-5 text-[0.95rem] leading-relaxed text-[var(--uw-soft)]">{label}</p>;
  }
  const badge = q.sensitive ? <span className="uw-badge">{labels.sensitive}</span> : !q.required ? <span className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[var(--uw-muted)]" style={{ fontFamily: "var(--uw-sans)" }}>{optional}</span> : null;

  if (q.type === "photos") {
    return (
      <div>
        <p className="uw-label">{label}{badge && <span className="mt-2 block leading-none">{badge}</span>}</p>
        {help && <p className="uw-help">{help}</p>}
        <PhotoField q={q} initial={photoEntries(value)} auth={photoAuth} labels={labels.photos} />
        {error && <p className="uw-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (q.type === "single" || q.type === "multi") {
    const multi = q.type === "multi";
    const selected = Array.isArray(value) ? value : value ? [String(value)] : [];
    const wide = (q.options?.length ?? 0) >= 4;
    return (
      <fieldset aria-invalid={!!error}>
        <legend className="uw-label">{label}{badge && <span className="mt-2 block leading-none">{badge}</span>}</legend>
        {help && <p className="uw-help">{help}</p>}
        <div className={`mt-5 grid gap-3 ${wide ? "sm:grid-cols-2" : ""}`}>
          {q.options!.map((o) => (
            <label key={o.value} className="uw-choice">
              <input
                type={multi ? "checkbox" : "radio"}
                name={name}
                value={o.value}
                checked={selected.includes(o.value)}
                onChange={(e) => {
                  if (!multi) return onChange(o.value);
                  const next = e.target.checked ? [...selected, o.value] : selected.filter((x) => x !== o.value);
                  onChange(next.length ? next : undefined);
                }}
              />
              <span className="uw-choice-dot" data-multi={multi} aria-hidden />
              <span>
                <span className="block text-[0.98rem] leading-snug">{tx(o.label, locale)}</span>
                {o.description && <span className="uw-small mt-1 block">{tx(o.description, locale)}</span>}
              </span>
            </label>
          ))}
        </div>
        {error && <p className="uw-error" role="alert">{error}</p>}
      </fieldset>
    );
  }

  const max = defaultMaxLength(q);
  const str = value === undefined ? "" : String(value);
  const common = { id: q.id, name, "aria-invalid": !!error, className: "uw-input", placeholder: tx(q.placeholder, locale) || undefined };
  return (
    <Field label={label} htmlFor={q.id} help={help} error={error} badge={badge}>
      {q.type === "longtext" ? (
        <>
          <textarea {...common} rows={5} maxLength={max} value={str} onChange={(e) => onChange(e.target.value)} />
          <p className="uw-small mt-2 text-right tabular-nums">{str.length} / {max}</p>
        </>
      ) : q.type === "number" ? (
        <input {...common} type="number" inputMode="numeric" min={q.min} max={q.max} value={str} onChange={(e) => onChange(e.target.value)} />
      ) : q.type === "date" ? (
        <input {...common} inputMode="numeric" maxLength={10} placeholder={common.placeholder ?? "1987"} value={str} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} maxLength={max} value={str} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
      )}
    </Field>
  );
}

const fillVars = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Réduit une photo dans le navigateur (2400 px, JPEG) ; renvoie le fichier d'origine si impossible (ex. HEIC sous Chrome). */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (blob) return blob;
  } catch {
    /* format non décodable par ce navigateur : le serveur essaiera */
  }
  return file;
}

function photoUrl(id: string, auth: PhotoAuth) {
  const qs = "token" in auth ? `token=${encodeURIComponent(auth.token)}` : `product=${encodeURIComponent(auth.product)}`;
  return `/api/u/photos/${id}?${qs}`;
}

/**
 * Photos d'une question : téléversées une à une dès leur choix (privées), puis légendées.
 * Les légendes et l'ordre sont enregistrés avec l'étape (champs cachés « a:<question> »).
 */
function PhotoField({ q, initial, auth, labels }: { q: Question; initial: PhotoEntry[]; auth: PhotoAuth; labels: Dictionary["questionnaire"]["photos"] }) {
  const max = q.maxFiles ?? DEFAULT_MAX_PHOTOS;
  const [entries, setEntries] = useState<Array<PhotoEntry & { lowRes?: boolean }>>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const name = `a:${q.id}`;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, Math.max(0, max - entries.length));
    for (let i = 0; i < list.length; i += 1) {
      setBusy(fillVars(labels.adding, { current: i + 1, total: list.length }));
      const blob = await shrink(list[i]);
      if (blob.size > MAX_UPLOAD_BYTES) {
        setError(labels.errors.too_large);
        continue;
      }
      const body = new FormData();
      body.set("file", blob, "photo.jpg");
      body.set("question", q.id);
      if ("token" in auth) body.set("token", auth.token);
      else body.set("product", auth.product);
      try {
        const res = await fetch("/api/u/photos", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { id?: string; lowRes?: boolean; error?: keyof typeof labels.errors };
        if (!res.ok || !json.id) {
          setError(labels.errors[json.error ?? "error"] ?? labels.errors.error);
          if (json.error === "too_many" || json.error === "rate_limited") break;
          continue;
        }
        setEntries((cur) => [...cur, { id: json.id!, caption: "", lowRes: json.lowRes }]);
      } catch {
        setError(labels.errors.error);
      }
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh(); // met à jour « Votre livre se construit » (photos déjà enregistrées côté serveur)
  }

  async function remove(id: string) {
    setError(null);
    const qs = "token" in auth ? `token=${encodeURIComponent(auth.token)}` : `product=${encodeURIComponent(auth.product)}`;
    const res = await fetch(`/api/u/photos/${id}?${qs}`, { method: "DELETE" }).catch(() => null);
    if (res && (res.ok || res.status === 404)) {
      setEntries((cur) => cur.filter((e) => e.id !== id));
      router.refresh();
    } else setError(labels.errors.error);
  }

  return (
    <div className="mt-5">
      {entries.map((e) => <input key={e.id} type="hidden" name={name} value={formatPhotoEntry(e)} />)}
      {entries.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {entries.map((e) => (
            <li key={e.id} className="border border-[var(--uw-line)] bg-[var(--uw-white)] p-3">
              <div className="relative aspect-[4/3] overflow-hidden bg-[#EFEBE3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(e.id, auth)} alt={e.caption} className="h-full w-full object-cover" loading="lazy" />
                <button type="button" onClick={() => remove(e.id)} className="absolute right-2 top-2 bg-[var(--uw-white)]/90 px-2.5 py-1 text-[0.75rem] hover:bg-[var(--uw-white)]">{labels.remove}</button>
              </div>
              {e.lowRes && <p className="mt-2 text-[0.78rem] text-[#8a5a22]">{labels.lowRes}</p>}
              <label className="mt-3 block">
                <span className="sr-only">{labels.caption}</span>
                <input
                  className="uw-input !py-2 !text-[0.9rem]"
                  maxLength={PHOTO_CAPTION_MAX}
                  placeholder={labels.captionPlaceholder}
                  aria-label={labels.caption}
                  value={e.caption}
                  onChange={(ev) => { const v = ev.target.value.replace(/::/g, ":"); setEntries((cur) => cur.map((x) => (x.id === e.id ? { ...x, caption: v } : x))); }}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className={`flex flex-wrap items-center gap-4 ${entries.length ? "mt-5" : ""}`}>
        {entries.length < max ? (
          <label className={`uw-btn uw-btn--ghost cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" disabled={!!busy} onChange={(ev) => upload(ev.target.files)} />
            {busy ?? (entries.length ? labels.addMore : labels.add)}
          </label>
        ) : (
          <p className="uw-small">{labels.full}</p>
        )}
        <span className="uw-small tabular-nums">{fillVars(labels.count, { count: entries.length, max })}</span>
      </div>
      {error && <p className="uw-error" role="alert">{error}</p>}
    </div>
  );
}
