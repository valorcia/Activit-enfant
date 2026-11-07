import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { CsvImport } from "@/components/admin/csv-import";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Importation" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requirePermission("products:import");
  const jobs = await prisma.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { createdBy: { select: { email: true } } } });
  return (
    <div>
      <AdminPageHeader title="Importation de produits" description="Importez plusieurs produits d'un coup via CSV. Pour les automatisations (IA, outils externes), utilisez l'API d'importation (menu API & automatisation)." />
      <CsvImport />
      <h2 className="mb-3 mt-8 font-heading text-lg font-bold">Historique des imports</h2>
      <DataTable rows={jobs} rowKey={(j) => j.id} empty="Aucun import pour l'instant."
        columns={[
          { key: "date", header: "Date", render: (j) => <span>{formatDateTime(j.createdAt)}</span> },
          { key: "source", header: "Source", render: (j) => <span>{j.source}{j.fileName ? ` · ${j.fileName}` : ""}</span> },
          { key: "by", header: "Par", render: (j) => <span className="text-ink-muted">{j.createdBy?.email ?? "API"}</span> },
          { key: "result", header: "Résultat", render: (j) => <span>{j.created} créé(s) · {j.updated} mis à jour · <span className={j.failed ? "text-red-600 font-semibold" : ""}>{j.failed} échec(s)</span> / {j.total}</span> },
          { key: "status", header: "Statut", render: (j) => <span className="text-xs font-bold">{({ RUNNING: "En cours", COMPLETED: "Terminé", FAILED: "Échoué" })[j.status]}</span> },
        ]} />
    </div>
  );
}
