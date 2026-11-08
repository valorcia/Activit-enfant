"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, KeyRound, PlugZap, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormSection } from "@/components/admin/form-controls";
import { deleteIntegrationSecretAction, saveIntegrationSecretsAction, testIntegrationAction } from "@/app/actions/admin/integrations";
import { SERVICES, type ServiceDef } from "@/lib/integrations/services";
import type { SecretStatus } from "@/lib/integrations/secrets";
import { cn } from "@/lib/utils";

export interface InfraState { storageDriver: string; s3Configured: boolean; cronSecretPresent: boolean; appUrl: string }

function SourceBadge({ status }: { status?: SecretStatus }) {
  if (!status || status.source === "missing") return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700"><XCircle className="size-3.5" /> Manquante</span>;
  const hint = status.hint ? ` ••••${status.hint}` : "";
  if (status.source === "database") return <span className="inline-flex items-center gap-1 rounded-full bg-sage-light px-2 py-0.5 text-xs font-bold text-sage-dark"><CheckCircle2 className="size-3.5" /> Via la plateforme{hint}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-sky-light px-2 py-0.5 text-xs font-bold text-sky-dark"><CheckCircle2 className="size-3.5" /> Via l&apos;hébergement (Vercel){hint}</span>;
}

function ServiceCard({ service, statuses, canEncrypt, appUrl, onStatuses }: { service: ServiceDef; statuses: SecretStatus[]; canEncrypt: boolean; appUrl: string; onStatuses: (s: SecretStatus[]) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const byKey = new Map(statuses.map((s) => [s.key, s]));
  const required = service.fields.filter((f) => !f.optional);
  const configured = required.every((f) => byKey.get(f.key)?.source !== "missing");
  const dirty = Object.values(values).some((v) => v.trim());

  const save = () => start(async () => {
    const r = await saveIntegrationSecretsAction(service.id, values);
    if (!r.ok) { toast.error(r.error); return; }
    onStatuses(r.data);
    setValues({});
    setTest(null);
    toast.success(`${service.title} : clés enregistrées`);
  });
  const remove = (key: string, label: string) => {
    if (!window.confirm(`Supprimer « ${label} » de la plateforme ? La variable d'environnement prendra le relais si elle existe.`)) return;
    start(async () => {
      const r = await deleteIntegrationSecretAction(key);
      if (!r.ok) { toast.error(r.error); return; }
      onStatuses(r.data);
      setTest(null);
      toast.success("Clé supprimée de la plateforme");
    });
  };
  const runTest = () => start(async () => {
    const r = await testIntegrationAction(service.id);
    if (!r.ok) { toast.error(r.error); return; }
    setTest(r.data);
  });

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
            {configured ? <CheckCircle2 className="size-5 text-sage-dark" /> : <KeyRound className="size-5 text-ink-muted" />}
            {service.title}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">{service.description}</p>
          <a href={service.helpUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-coral-dark hover:underline">{service.helpLabel} <ExternalLink className="size-3" /></a>
        </div>
        {service.testable && <Button type="button" variant="outline" size="sm" onClick={runTest} disabled={pending}><PlugZap className="size-4" /> Tester</Button>}
      </header>

      {service.oauthCallbackPaths && (
        <div className="mt-3 rounded-xl bg-cream p-3 text-xs">
          <p className="font-bold">URL de rappel OAuth à déclarer dans l&apos;application {service.id === "meta" ? "Meta" : "TikTok"} :</p>
          {service.oauthCallbackPaths.map((p) => {
            const url = `${appUrl}${p}`;
            return (
              <button key={p} type="button" className="mt-1 inline-flex max-w-full items-center gap-1 break-all rounded-md bg-white px-2 py-1 font-mono text-[11px] hover:bg-ink/5" onClick={() => { void navigator.clipboard.writeText(url); toast.success("URL copiée"); }}>
                <Copy className="size-3 shrink-0" /> {url}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {service.fields.map((f) => {
          const status = byKey.get(f.key);
          return (
            <FormField key={f.key} label={`${f.label}${f.optional ? " (facultatif)" : ""}`} hint={f.help}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <SourceBadge status={status} />
                {status?.source === "database" && (
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50" disabled={pending} onClick={() => remove(f.key, f.label)}>
                    <Trash2 className="size-3.5" /> Supprimer
                  </button>
                )}
              </div>
              <Input
                type={f.plain ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                disabled={!canEncrypt || pending}
                placeholder={status && status.source !== "missing" ? "Laisser vide pour conserver la valeur actuelle" : f.placeholder ?? ""}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </FormField>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="admin" size="sm" onClick={save} disabled={!canEncrypt || pending || !dirty}>Enregistrer</Button>
        {test && (
          <p role="status" className={cn("flex items-start gap-1.5 text-sm", test.ok ? "text-sage-dark" : "text-red-700")}>
            {test.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />} {test.message}
          </p>
        )}
      </div>
    </section>
  );
}

function InfraStatus({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 text-sage-dark" /> : <XCircle className="mt-0.5 size-4 text-red-500" />}
      <span><span className="font-semibold">{label}</span>{detail && <span className="block text-xs text-ink-muted">{detail}</span>}</span>
    </li>
  );
}

/** Onglet Intégrations : saisie chiffrée des clés de chaque service, test de connexion, état de l'hébergement. */
export function IntegrationsForm({ statuses: s0, canEncrypt, infra }: { statuses: SecretStatus[]; canEncrypt: boolean; infra: InfraState }) {
  const [statuses, setStatuses] = useState(s0);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-4 text-sm text-ink-soft">
        Les clés saisies ici sont <strong>chiffrées</strong> en base et ne sont jamais réaffichées (seuls les 4 derniers caractères apparaissent). Elles ont la priorité sur les variables d&apos;environnement de l&apos;hébergement, qui restent utilisées en secours.
      </div>
      {!canEncrypt && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>La saisie est désactivée : le chiffrement exige la variable <code>AUTH_SECRET</code> (ou <code>MARKETING_ENCRYPTION_KEY</code>) dans l&apos;hébergement. Ajoutez-la sur Vercel puis redéployez.</span>
        </div>
      )}
      {SERVICES.map((service) => (
        <ServiceCard key={service.id} service={service} statuses={statuses} canEncrypt={canEncrypt} appUrl={infra.appUrl} onStatuses={setStatuses} />
      ))}
      <FormSection title="Hébergement" description="Ces réglages restent dans les variables d'environnement de l'hébergeur.">
        <ul className="space-y-2">
          <InfraStatus ok={infra.storageDriver === "s3" ? infra.s3Configured : true} label={`Stockage des fichiers : ${infra.storageDriver === "s3" ? "S3 compatible" : "local (développement)"}`} detail={infra.storageDriver === "local" ? "Passer en S3 (STORAGE_DRIVER=s3) avant la mise en production sur Vercel" : "S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY"} />
          <InfraStatus ok={infra.cronSecretPresent} label="Secret des tâches planifiées" detail="CRON_SECRET · /api/cron/publish et /api/cron/marketing" />
          <InfraStatus ok label="Endpoint du webhook Stripe" detail={`${infra.appUrl}/api/stripe/webhook — événements : checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, payment_intent.payment_failed, charge.refunded`} />
        </ul>
      </FormSection>
    </div>
  );
}
