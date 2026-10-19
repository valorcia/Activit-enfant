import { PageHeader } from "@/components/page-header";
import { BookWizard } from "@/components/book-wizard";
import { getAiSettings } from "@/lib/settings";
import { estimateBookCost } from "@/lib/queue/estimate";

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  const settings = await getAiSettings();
  const perActivity = estimateBookCost(settings, { activities: 1, includeCover: false }).total;
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader title="Nouveau livre" description="Assistant guidé : type, âge, nombre d'activités, style graphique, format, puis génération du sommaire." />
      <BookWizard perActivityCost={perActivity} textProvider={settings.textProvider} />
    </div>
  );
}
