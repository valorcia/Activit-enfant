"use client";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { giftSaveStepAction, saveStepAction, type UwFormState } from "@/app/actions/unwritten";
import { currentUtm } from "@/lib/analytics/utm";
import type { DraftMode, Locale } from "@/lib/unwritten/constants";
import type { Dictionary } from "@/lib/unwritten/i18n/en";
import { defaultMaxLength, isAnswered, visibleSteps, type AnswerValue, type Answers, type Audience } from "@/lib/unwritten/questionnaire/engine";
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
            {questions.map((q) => <QuestionField key={q.id} q={q} locale={locale} value={values[q.id]} onChange={(v) => set(q.id, v)} error={err[q.id]} labels={labels} optional={props.common.optional} />)}
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

function QuestionField({ q, locale, value, onChange, error, labels, optional }: { q: Question; locale: Locale; value: AnswerValue | undefined; onChange: (v: AnswerValue | undefined) => void; error?: string; labels: Dictionary["questionnaire"]; optional: string }) {
  const name = `a:${q.id}`;
  const label = tx(q.label, locale);
  const help = tx(q.help, locale) || undefined;
  if (q.type === "info") {
    return <p className="border-l border-[var(--uw-champagne)] py-1 pl-5 text-[0.95rem] leading-relaxed text-[var(--uw-soft)]">{label}</p>;
  }
  const badge = q.sensitive ? <span className="uw-badge">{labels.sensitive}</span> : !q.required ? <span className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[var(--uw-muted)]" style={{ fontFamily: "var(--uw-sans)" }}>{optional}</span> : null;

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
