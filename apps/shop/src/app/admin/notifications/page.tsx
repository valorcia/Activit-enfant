import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { PushSettings } from "@/components/admin/push-settings";
import { PushDeviceRow } from "@/components/admin/push-device-row";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requirePermission("orders:read");
  const devices = await prisma.pushSubscription.findMany({
    where: user.role === "ADMIN" ? {} : { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return (
    <div>
      <AdminPageHeader title="Notifications" description="Recevez une notification sur votre téléphone à chaque nouvelle commande payée." />
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="Cet appareil">
          <PushSettings />
          <div className="mt-5 space-y-2 text-sm text-ink-soft">
            <p><strong>Android</strong> : ouvrez l&apos;admin dans Chrome, menu ⋮ → « Ajouter à l&apos;écran d&apos;accueil » (facultatif), puis activez ici.</p>
            <p><strong>iPhone</strong> : Safari → Partager → « Sur l&apos;écran d&apos;accueil », ouvrez l&apos;application installée, puis activez ici (iOS 16.4 ou plus).</p>
            <p>Le contenu affiché : numéro de commande, montant et produits. Jamais l&apos;adresse e-mail du client.</p>
          </div>
        </AdminCard>
        <AdminCard title={user.role === "ADMIN" ? "Appareils de l'équipe" : "Mes appareils"}>
          {devices.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucun appareil abonné pour le moment.</p>
          ) : (
            <ul className="divide-y divide-line">
              {devices.map((d) => (
                <PushDeviceRow key={d.id} id={d.id} label={d.deviceLabel ?? "Appareil"} owner={d.user.name ?? d.user.email} since={d.createdAt.toISOString()} lastSuccess={d.lastSuccessAt?.toISOString() ?? null} />
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
