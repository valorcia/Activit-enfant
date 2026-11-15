import type { Metadata } from "next";
import "../globals.css";
import { Sidebar } from "@/components/sidebar";
import { StorageBanner } from "@/components/storage-banner";
import { getAiSettings, getShopSettings, getStudioSettings } from "@/lib/settings";
import { pendingCount } from "@/lib/manual/requests";
import { prisma } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getStudioSettings().catch(() => null);
  return { title: studio?.studioName ?? "La Malle à Jeux · Studio", description: "Studio de création des kits et e-books La Malle à Jeux" };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, pendingManual, studio, activeRuns, shop] = await Promise.all([
    getAiSettings().catch(() => null),
    pendingCount().catch(() => 0),
    getStudioSettings().catch(() => null),
    prisma.autopilotRun.count({ where: { status: { in: ["RUNNING", "WAITING_INPUT", "WAITING_APPROVAL"] } } }).catch(() => 0),
    getShopSettings().catch(() => null),
  ]);
  return (
    <html lang="fr">
      <body className="min-h-screen font-sans">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar mode={settings?.mode ?? "api"} pendingManual={pendingManual} activeRuns={activeRuns} studioName={studio?.studioName} shopUrl={shop?.shopApiUrl ?? ""} />
          <main className="flex-1 min-w-0"><StorageBanner />{children}</main>
        </div>
      </body>
    </html>
  );
}
