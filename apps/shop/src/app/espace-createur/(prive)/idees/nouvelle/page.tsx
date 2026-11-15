import { requireCreatorWithContract } from "@/lib/creators/session";
import { getCreatorSettings, formatPoints, formatRate } from "@/lib/creators/settings";
import { MAX_PHOTOS, MIN_PHOTOS } from "@/lib/creators/submissions";
import { SubmissionForm } from "@/components/creator/submission-form";
import { emptySubmission } from "@/components/creator/submission-value";
import { Alert } from "@/components/ui/misc";

export const metadata = { title: "Proposer une idée" };

export default async function NewIdeaPage() {
  const [creator, s] = await Promise.all([requireCreatorWithContract(), getCreatorSettings()]);
  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-3xl font-bold">Proposer une idée</h1>
      <p className="mt-2 text-ink-soft">Décrivez l&apos;activité comme vous l&apos;expliqueriez à une amie. Vous pouvez enregistrer un brouillon et revenir plus tard.</p>
      {creator.status !== "ACTIVE" ? (
        <Alert variant="warning" className="mt-6">Votre compte n&apos;est pas encore actif : contactez-nous.</Alert>
      ) : (
        <div className="mt-6">
          <SubmissionForm id={null} initial={emptySubmission()} minPhotos={MIN_PHOTOS} maxPhotos={MAX_PHOTOS} rates={{ idea: formatRate(s.ideaRateBp), full: formatRate(s.fullTutorialRateBp), bonus: formatPoints(s.exclusivityBonusBp) }} />
        </div>
      )}
    </div>
  );
}
