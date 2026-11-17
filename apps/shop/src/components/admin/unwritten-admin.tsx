"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/admin/form-controls";
import {
  checkDefinitionAction, publishQuestionnaireAction, requeueItemAction, resendBookReadyAction, resendGiftLinkAction,
  saveBrandSettingsAction, saveProductSettingsAction, saveQuestionnaireAction, type DefinitionCheck,
} from "@/app/actions/admin/unwritten";
import type { UnwrittenConfig } from "@/lib/unwritten/config";

/** Composants d'administration UNWRITTEN (interface en français). */

export function PersonalItemActions({ itemId, status, giftPending }: { itemId: string; status: string; giftPending: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {giftPending && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await resendGiftLinkAction(itemId); if (r.ok) toast.success(`Nouveau lien envoyé ${r.data.to}`); else toast.error(r.error); router.refresh(); })}>
          Relancer le destinataire (nouveau lien)
        </Button>
      )}
      {status === "ERROR" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await requeueItemAction(itemId); if (r.ok) toast.success("Remis dans la file du studio"); else toast.error(r.error); router.refresh(); })}>
          Remettre en file de production
        </Button>
      )}
      {status === "DELIVERED" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await resendBookReadyAction(itemId); if (r.ok) toast.success("E-mail de livraison renvoyé"); else toast.error(r.error); })}>
          Renvoyer l&apos;e-mail de livraison
        </Button>
      )}
    </div>
  );
}

export function QuestionnaireEditor({ productId, initialJson }: { productId: string; initialJson: string }) {
  const [json, setJson] = useState(initialJson);
  const [note, setNote] = useState("");
  const [check, setCheck] = useState<DefinitionCheck | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const validate = () => start(async () => setCheck(await checkDefinitionAction(json)));
  const save = (publish: boolean) => start(async () => {
    const c = await checkDefinitionAction(json);
    setCheck(c);
    if (!c.ok) return void toast.error("Définition invalide : corrigez les erreurs");
    const r = await saveQuestionnaireAction(productId, json, { publish, note });
    if (r.ok) { toast.success(publish ? `Version ${r.data.version} publiée` : `Version ${r.data.version} enregistrée (brouillon)`); router.refresh(); } else toast.error(r.error);
  });
  return (
    <div className="space-y-4">
      <Textarea value={json} onChange={(e) => { setJson(e.target.value); setCheck(null); }} spellCheck={false} className="min-h-[520px] font-mono text-xs leading-relaxed" aria-label="Définition JSON du questionnaire" />
      <FormField label="Note de version (facultative)" htmlFor="q-note"><Input id="q-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ex. : question sur le ton reformulée" /></FormField>
      {check && (
        <div className={`rounded-xl border p-3 text-sm ${check.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          {check.ok ? <p className="font-bold">Définition valide{check.questions ? ` · ${check.questions.min} à ${check.questions.max} questions visibles selon le parcours` : ""}</p> : <p className="font-bold">Définition invalide</p>}
          {check.errors.length > 0 && <ul className="mt-2 list-disc pl-5">{check.errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul>}
          {check.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-800">{check.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={validate}>Valider</Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => save(false)}>Enregistrer comme brouillon</Button>
        <Button variant="admin" size="sm" disabled={pending} onClick={() => save(true)}>Enregistrer et publier</Button>
      </div>
      <p className="text-xs text-ink-muted">Chaque enregistrement crée une nouvelle version ; une version publiée n&apos;est jamais modifiée. Les brouillons de clients déjà commencés gardent leur version.</p>
    </div>
  );
}

export function PublishVersionButton({ questionnaireId }: { questionnaireId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await publishQuestionnaireAction(questionnaireId); if (r.ok) toast.success("Version publiée"); else toast.error(r.error); router.refresh(); })}>Publier</Button>;
}

const LOCALE_NAMES: Record<string, string> = { en: "Anglais", fr: "Français" };

export function BrandSettingsForm({ siteId, supported, openLocales, defaultLocale, config }: { siteId: string; supported: string[]; openLocales: string[]; defaultLocale: string; config: UnwrittenConfig }) {
  const [open, setOpen] = useState<string[]>(openLocales);
  const [def, setDef] = useState(defaultLocale);
  const [c, setC] = useState(config);
  const [pending, start] = useTransition();
  const router = useRouter();
  const num = (k: keyof UnwrittenConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) });
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-bold">Ouverture par langue</legend>
        <p className="text-xs text-ink-muted">Une langue fermée redirige vers la langue par défaut. N&apos;ouvrez un marché qu&apos;une fois paiement, mentions légales, CGV et contenus validés.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {supported.map((l) => (
            <label key={l} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-coral" checked={open.includes(l)} onChange={(e) => setOpen(e.target.checked ? [...open, l] : open.filter((x) => x !== l))} />
              {LOCALE_NAMES[l] ?? l} ({l})
            </label>
          ))}
        </div>
      </fieldset>
      <FormField label="Langue par défaut" htmlFor="b-def">
        <select id="b-def" value={def} onChange={(e) => setDef(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm">
          {supported.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l] ?? l}</option>)}
        </select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Conservation d'un brouillon inactif (jours)" htmlFor="b-draft"><Input id="b-draft" type="number" min={1} max={365} value={c.draftRetentionDays} onChange={num("draftRetentionDays")} /></FormField>
        <FormField label="Validité d'un lien de reprise (heures)" htmlFor="b-resume"><Input id="b-resume" type="number" min={1} max={720} value={c.resumeLinkValidityHours} onChange={num("resumeLinkValidityHours")} /></FormField>
        <FormField label="Conservation des réponses après livraison (jours)" htmlFor="b-keep"><Input id="b-keep" type="number" min={7} max={730} value={c.deliveredDataRetentionDays} onChange={num("deliveredDataRetentionDays")} /></FormField>
        <FormField label="Validité du lien cadeau (jours)" htmlFor="b-gift"><Input id="b-gift" type="number" min={1} max={365} value={c.giftLinkValidityDays} onChange={num("giftLinkValidityDays")} /></FormField>
        <FormField label="Téléchargements autorisés par livre" htmlFor="b-dl"><Input id="b-dl" type="number" min={1} max={100} value={c.maxDownloads} onChange={num("maxDownloads")} /></FormField>
        <FormField label="Préfixe des commandes" htmlFor="b-prefix"><Input id="b-prefix" value={c.orderPrefix} maxLength={6} onChange={(e) => setC({ ...c, orderPrefix: e.target.value.toUpperCase() })} /></FormField>
        <FormField label="E-mail de contact (vitrine et e-mails)" htmlFor="b-mail" className="sm:col-span-2"><Input id="b-mail" type="email" value={c.contactEmail ?? ""} onChange={(e) => setC({ ...c, contactEmail: e.target.value || null })} /></FormField>
      </div>
      <Button variant="admin" size="sm" disabled={pending} onClick={() => start(async () => { const r = await saveBrandSettingsAction(siteId, { openLocales: open, defaultLocale: def, config: c }); if (r.ok) toast.success("Réglages enregistrés"); else toast.error(r.error); router.refresh(); })}>Enregistrer</Button>
    </div>
  );
}

export function ProductSettingsForm({ productId, currencies, prices, deliveryDaysMin, deliveryDaysMax, pagesMin, pagesMax }: { productId: string; currencies: string[]; prices: Record<string, number>; deliveryDaysMin: number; deliveryDaysMax: number; pagesMin: number | null; pagesMax: number | null }) {
  const [p, setP] = useState<Record<string, string>>(Object.fromEntries(currencies.map((c) => [c, prices[c] != null ? (prices[c] / 100).toFixed(2) : ""])));
  const [d, setD] = useState({ deliveryDaysMin, deliveryDaysMax, pagesMin: pagesMin ?? "", pagesMax: pagesMax ?? "" });
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = () => start(async () => {
    const parsed = Object.fromEntries(Object.entries(p).filter(([, v]) => v.trim()).map(([k, v]) => [k, Math.round(Number(v.replace(",", ".")) * 100)]));
    const r = await saveProductSettingsAction(productId, { prices: parsed, deliveryDaysMin: Number(d.deliveryDaysMin), deliveryDaysMax: Number(d.deliveryDaysMax), pagesMin: d.pagesMin === "" ? null : Number(d.pagesMin), pagesMax: d.pagesMax === "" ? null : Number(d.pagesMax) });
    if (r.ok) toast.success("Produit enregistré"); else toast.error(r.error);
    router.refresh();
  });
  return (
    <div className="grid items-end gap-3 sm:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
      {currencies.map((c) => (
        <FormField key={c} label={`Prix TTC (${c})`} htmlFor={`p-${productId}-${c}`}><Input id={`p-${productId}-${c}`} inputMode="decimal" value={p[c] ?? ""} onChange={(e) => setP({ ...p, [c]: e.target.value })} /></FormField>
      ))}
      <FormField label="Délai min. (jours)" htmlFor={`dmin-${productId}`}><Input id={`dmin-${productId}`} type="number" value={d.deliveryDaysMin} onChange={(e) => setD({ ...d, deliveryDaysMin: Number(e.target.value) })} /></FormField>
      <FormField label="Délai max. (jours)" htmlFor={`dmax-${productId}`}><Input id={`dmax-${productId}`} type="number" value={d.deliveryDaysMax} onChange={(e) => setD({ ...d, deliveryDaysMax: Number(e.target.value) })} /></FormField>
      <FormField label="Pages min." htmlFor={`pmin-${productId}`}><Input id={`pmin-${productId}`} type="number" value={d.pagesMin} onChange={(e) => setD({ ...d, pagesMin: e.target.value })} /></FormField>
      <FormField label="Pages max." htmlFor={`pmax-${productId}`}><Input id={`pmax-${productId}`} type="number" value={d.pagesMax} onChange={(e) => setD({ ...d, pagesMax: e.target.value })} /></FormField>
      <Button variant="admin" size="sm" className="h-10" disabled={pending} onClick={submit}>Enregistrer</Button>
    </div>
  );
}
