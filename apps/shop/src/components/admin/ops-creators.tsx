"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Mail, Send, UserPlus, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/admin/form-controls";
import { ConfirmButton } from "@/components/admin/confirm-button";
import {
  cancelCommissionAction, cancelPayoutAction, confirmCommissionsAction, confirmDueCommissionsAction, inviteCreatorAction, linkSubmissionProductAction,
  markPayoutPaidAction, moderateSubmissionAction, preparePayoutsAction, resendInviteAction, saveCreatorSettingsAction, setProductCreatorRateAction, updateCreatorAction,
} from "@/app/actions/admin/creators";
import type { CreatorsSettings } from "@/lib/schemas/settings";

const pctToBp = (v: string): number | null => (v.trim() === "" ? null : Math.round(Number(v.replace(",", ".")) * 100));
const bpToPct = (bp: number | null | undefined): string => (bp == null ? "" : String(bp / 100).replace(".", ","));

export function InviteCreatorForm() {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const r = await inviteCreatorAction({ name: fd.get("name"), email: fd.get("email") });
          if (r.ok) { toast.success("Invitation envoyée"); form.reset(); setErrors({}); } else { setErrors(r.fieldErrors ?? {}); toast.error(r.error); }
        });
      }}
    >
      <FormField label="Nom" htmlFor="inv-name" error={errors.name} required><Input id="inv-name" name="name" required placeholder="Marie Dupont" autoComplete="off" /></FormField>
      <FormField label="E-mail" htmlFor="inv-email" error={errors.email} required><Input id="inv-email" name="email" type="email" required placeholder="marie@exemple.fr" autoComplete="off" /></FormField>
      <Button type="submit" variant="admin" disabled={pending}><UserPlus className="size-4" /> {pending ? "Envoi…" : "Inviter"}</Button>
    </form>
  );
}

export function CreatorControls({ id, status, defaultRateBp, hasContract }: { id: string; status: string; defaultRateBp: number | null; hasContract: boolean }) {
  const [rate, setRate] = useState(bpToPct(defaultRateBp));
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => start(async () => { const r = await fn(); if (r.ok) toast.success(msg); else toast.error(r.error ?? "Erreur"); });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-bold text-ink-muted">Statut
        <NativeSelect className="mt-1 h-9 w-40 text-sm" value={status} disabled={pending} onChange={(e) => run(() => updateCreatorAction(id, { status: e.target.value }), "Statut mis à jour")}>
          <option value="INVITED">Invitée</option>
          <option value="ACTIVE" disabled={!hasContract}>Active</option>
          <option value="SUSPENDED">Suspendue</option>
        </NativeSelect>
      </label>
      <label className="text-xs font-bold text-ink-muted">Taux par défaut (%)
        <span className="mt-1 flex gap-1">
          <Input className="h-9 w-24 text-sm" inputMode="decimal" placeholder="selon l'apport" value={rate} onChange={(e) => setRate(e.target.value)} />
          <Button size="sm" variant="soft" disabled={pending} onClick={() => run(() => updateCreatorAction(id, { defaultRateBp: pctToBp(rate) }), "Taux enregistré")}>OK</Button>
        </span>
      </label>
      {status !== "SUSPENDED" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resendInviteAction(id), "Lien envoyé")}><Mail className="size-4" /> Renvoyer un lien</Button>}
    </div>
  );
}

export function ProductRateControl({ productId, rateBp }: { productId: string; rateBp: number | null }) {
  const [rate, setRate] = useState(bpToPct(rateBp));
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-1">
      <Input aria-label="Taux du produit (%)" className="h-8 w-20 text-xs" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
      <Button size="sm" variant="soft" className="h-8 px-3 text-xs" disabled={pending} onClick={() => start(async () => { const r = await setProductCreatorRateAction(productId, pctToBp(rate)); if (r.ok) toast.success("Taux du produit enregistré"); else toast.error(r.error); })}>OK</Button>
    </span>
  );
}

export function ModerationForm({ id, status, suggestedRateBp }: { id: string; status: string; suggestedRateBp: number }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [rate, setRate] = useState(bpToPct(suggestedRateBp));
  const [pending, start] = useTransition();
  const decide = (decision: "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED") => start(async () => {
    const r = await moderateSubmissionAction(id, { decision, comment, rateBp: decision === "ACCEPTED" ? pctToBp(rate) : undefined });
    if (r.ok) { toast.success(decision === "ACCEPTED" ? "Idée acceptée — e-mail envoyé" : decision === "REJECTED" ? "Idée refusée — e-mail envoyé" : "Modification demandée — e-mail envoyé"); router.refresh(); } else toast.error(r.error);
  });
  if (!["SUBMITTED", "CHANGES_REQUESTED", "ACCEPTED"].includes(status)) return null;
  return (
    <div className="space-y-3">
      <FormField label="Commentaire pour la créatrice" htmlFor="mod-comment" hint="Obligatoire pour refuser ou demander une modification. Il est envoyé par e-mail.">
        <Textarea id="mod-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ex. : pouvez-vous ajouter une photo de l'étape du collage ?" className="min-h-[90px]" />
      </FormField>
      {status !== "ACCEPTED" && (
        <FormField label="Taux de redevance retenu (%)" htmlFor="mod-rate" hint="Proposé selon l'apport et l'exclusivité (réglages du programme).">
          <Input id="mod-rate" inputMode="decimal" className="w-32" value={rate} onChange={(e) => setRate(e.target.value)} />
        </FormField>
      )}
      <div className="flex flex-wrap gap-2">
        {status !== "ACCEPTED" && <Button variant="sage" size="sm" disabled={pending} onClick={() => decide("ACCEPTED")}><Check className="size-4" /> Accepter</Button>}
        <Button variant="outline" size="sm" disabled={pending} onClick={() => decide("CHANGES_REQUESTED")}>Demander une modification</Button>
        <Button variant="ghost" size="sm" className="text-red-700" disabled={pending} onClick={() => decide("REJECTED")}><X className="size-4" /> Refuser</Button>
      </div>
    </div>
  );
}

export function LinkProductForm({ id }: { id: string }) {
  const [ref, setRef] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await linkSubmissionProductAction(id, ref); if (r.ok) { toast.success("Produit lié : la créatrice est créditée"); setRef(""); } else toast.error(r.error); }); }}>
      <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Identifiant ou slug du produit" className="h-9 max-w-xs text-sm" required />
      <Button size="sm" variant="soft" disabled={pending || !ref.trim()}>Lier au produit</Button>
    </form>
  );
}

export function CommissionsBulk({ pendingIds }: { pendingIds: string[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="admin" disabled={pending} onClick={() => start(async () => { const r = await confirmDueCommissionsAction(); if (r.ok) toast.success(`${r.data.count} commission(s) confirmée(s) (délai écoulé)`); else toast.error(r.error); })}>Confirmer celles dont le délai est écoulé</Button>
      {pendingIds.length > 0 && (
        <ConfirmButton size="sm" variant="outline" title={`Confirmer ${pendingIds.length} commission(s) maintenant ?`} description="Elles seront confirmées sans attendre la fin du délai de remboursement." confirmLabel="Confirmer" successMessage="Commissions confirmées" onConfirm={() => confirmCommissionsAction(pendingIds)}>
          Confirmer les {pendingIds.length} affichée(s) en attente
        </ConfirmButton>
      )}
    </div>
  );
}

export function CancelCommissionButton({ id }: { id: string }) {
  return <ConfirmButton size="sm" variant="ghost" className="h-8 px-2 text-xs text-red-700" title="Annuler cette commission ?" description="Elle ne sera pas payée." confirmLabel="Annuler la commission" successMessage="Commission annulée" onConfirm={() => cancelCommissionAction(id)}>Annuler</ConfirmButton>;
}

export function PreparePayoutsButton({ thresholdLabel }: { thresholdLabel: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="admin" disabled={pending} onClick={() => start(async () => {
      const r = await preparePayoutsAction();
      if (r.ok) toast.success(`${r.data.created} paiement(s) préparé(s)${r.data.updated ? `, ${r.data.updated} complété(s)` : ""}${r.data.below ? ` · ${r.data.below} créatrice(s) sous le seuil de ${thresholdLabel}, reporté(s)` : ""}`);
      else toast.error(r.error);
    })}><Wallet className="size-4" /> {pending ? "Préparation…" : "Préparer les paiements"}</Button>
  );
}

export function MarkPaidForm({ id }: { id: string }) {
  const [reference, setReference] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await markPayoutPaidAction(id, reference); if (r.ok) toast.success("Paiement marqué comme payé"); else toast.error(r.error); }); }}>
      <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence du virement" className="h-8 w-44 text-xs" required />
      <Button size="sm" variant="sage" className="h-8 px-3 text-xs" disabled={pending || !reference.trim()}><Send className="size-3.5" /> Marquer payé</Button>
      <ConfirmButton size="sm" variant="ghost" className="h-8 px-2 text-xs" title="Retirer ce paiement ?" description="Les commissions redeviennent disponibles pour la prochaine préparation." confirmLabel="Retirer" successMessage="Paiement retiré" onConfirm={() => cancelPayoutAction(id)}>Retirer</ConfirmButton>
    </form>
  );
}

export function CreatorSettingsForm({ initial }: { initial: CreatorsSettings }) {
  const [v, setV] = useState({
    idea: bpToPct(initial.ideaRateBp), full: bpToPct(initial.fullTutorialRateBp), bonus: bpToPct(initial.exclusivityBonusBp),
    delay: String(initial.confirmationDelayDays), threshold: String(initial.payoutThresholdCents / 100).replace(".", ","), price: String(initial.suggestedPriceCents / 100).replace(".", ","),
    feePct: bpToPct(initial.stripeFeePercentBp), feeFixed: String(initial.stripeFeeFixedCents / 100).replace(".", ","),
    login: String(initial.loginLinkValidityMinutes), invite: String(initial.inviteLinkValidityDays),
  });
  const [pending, start] = useTransition();
  const euros = (s: string) => Math.round(Number(s.replace(",", ".")) * 100);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const field = (k: keyof typeof v, label: string, hint?: string) => (
    <FormField label={label} htmlFor={`cs-${k}`} hint={hint}><Input id={`cs-${k}`} inputMode="decimal" value={v[k]} onChange={set(k)} /></FormField>
  );
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveCreatorSettingsAction({
          ideaRateBp: pctToBp(v.idea), fullTutorialRateBp: pctToBp(v.full), exclusivityBonusBp: pctToBp(v.bonus), confirmationDelayDays: Number(v.delay),
          payoutThresholdCents: euros(v.threshold), suggestedPriceCents: euros(v.price), stripeFeePercentBp: pctToBp(v.feePct), stripeFeeFixedCents: euros(v.feeFixed),
          loginLinkValidityMinutes: Number(v.login), inviteLinkValidityDays: Number(v.invite),
        });
        if (r.ok) toast.success("Réglages enregistrés"); else toast.error(r.error);
      });
    }}>
      {field("idea", "Taux « idée seule » (%)", "Idée + quelques photos, le studio fait le reste")}
      {field("full", "Taux « tutoriel complet » (%)", "Tutoriel complet avec ses photos des étapes")}
      {field("bonus", "Bonus d'exclusivité (points)", "Ajouté au taux si l'exclusivité est accordée")}
      {field("delay", "Délai de confirmation (jours)", "Délai de remboursement avant confirmation automatique")}
      {field("threshold", "Seuil de paiement (€)", "En dessous, les commissions sont reportées")}
      {field("price", "Prix conseillé des tutoriels (€)")}
      {field("feePct", "Frais Stripe estimés (%)", "Par commande, répartis au prorata des lignes")}
      {field("feeFixed", "Frais Stripe fixes estimés (€)", "Par commande")}
      {field("login", "Validité du lien de connexion (minutes)")}
      {field("invite", "Validité du lien d'invitation (jours)")}
      <div className="sm:col-span-2"><Button type="submit" variant="admin" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer les réglages"}</Button></div>
    </form>
  );
}

