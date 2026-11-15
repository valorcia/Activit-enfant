import { requireCreator } from "@/lib/creators/session";
import { CONTRACT_TITLE, CONTRACT_VERSION, contractSections } from "@/lib/creators/contract";
import { getCreatorSettings } from "@/lib/creators/settings";
import { ContractForm } from "@/components/creator/contract-form";
import { Alert } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Contrat" };

export default async function ContractPage() {
  const [creator, settings] = await Promise.all([requireCreator(), getCreatorSettings()]);
  const accepted = creator.contractVersion === CONTRACT_VERSION;
  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-3xl font-bold">{CONTRACT_TITLE}</h1>
      <p className="mt-1 text-sm text-ink-muted">Version {CONTRACT_VERSION}</p>
      {accepted ? (
        <Alert variant="success" title="Contrat accepté" className="mt-4">Vous avez accepté cette version le {formatDateTime(creator.contractAcceptedAt)}.</Alert>
      ) : creator.contractVersion ? (
        <Alert variant="warning" title="Nouvelle version" className="mt-4">Le contrat a été mis à jour. Merci de lire et d&apos;accepter cette nouvelle version pour continuer à proposer vos idées.</Alert>
      ) : (
        <p className="mt-4 text-ink-soft">Avant de proposer vos idées, prenez quelques minutes pour lire ce contrat. Il est écrit simplement ; n&apos;hésitez pas à nous poser vos questions.</p>
      )}
      <div className="card-soft mt-6 space-y-6 p-5 sm:p-8">
        {contractSections(settings).map((s) => (
          <section key={s.title}>
            <h2 className="font-heading text-lg font-bold">{s.title}</h2>
            {s.paragraphs.map((p, i) => <p key={i} className="mt-2 text-ink-soft">{p}</p>)}
          </section>
        ))}
      </div>
      {!accepted && <div className="mt-6"><ContractForm version={CONTRACT_VERSION} /></div>}
    </div>
  );
}
