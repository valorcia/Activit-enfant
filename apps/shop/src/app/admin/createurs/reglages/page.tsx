import { requirePermission } from "@/lib/auth/session";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { CreatorsNav } from "@/components/admin/creators/creators-nav";
import { CreatorSettingsForm } from "@/components/admin/ops-creators";
import { CONTRACT_ADMIN_NOTICE, CONTRACT_TITLE, CONTRACT_VERSION, contractSections } from "@/lib/creators/contract";
import { getCreatorSettings } from "@/lib/creators/settings";

export const metadata = { title: "Réglages du programme créatrices" };
export const dynamic = "force-dynamic";

export default async function CreatorSettingsPage() {
  await requirePermission("creators:payouts");
  const settings = await getCreatorSettings();
  return (
    <div>
      <AdminPageHeader title="Réglages du programme" description="Communs à tous les univers. Les taux s'appliquent aux nouvelles idées acceptées ; un produit garde le taux fixé lors de son lien avec la créatrice." />
      <CreatorsNav current="/admin/createurs/reglages" />
      <div className="grid gap-5 xl:grid-cols-2">
        <AdminCard title="Rémunération et paiements"><CreatorSettingsForm initial={settings} /></AdminCard>
        <AdminCard title="Contrat présenté aux créatrices" description={`${CONTRACT_TITLE} — version ${CONTRACT_VERSION}. Le texte est versionné dans le code (src/lib/creators/contract.ts) ; changer de version demande une nouvelle acceptation.`}>
          <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900" role="note">⚠ {CONTRACT_ADMIN_NOTICE}</p>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-sm">
            {contractSections(settings).map((s) => (
              <section key={s.title}><h3 className="font-bold">{s.title}</h3>{s.paragraphs.map((p, i) => <p key={i} className="mt-1 text-ink-soft">{p}</p>)}</section>
            ))}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
