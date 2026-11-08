import type { Metadata } from "next";
import "../globals.css";
import { Sidebar } from "@/components/sidebar";
import { getAiSettings } from "@/lib/settings";
import { pendingCount } from "@/lib/manual/requests";

export const metadata: Metadata = {
  title: "Inventor Studio",
  description: "Studio IA de création de livres d'activités pour enfants",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, pendingManual] = await Promise.all([getAiSettings().catch(() => null), pendingCount().catch(() => 0)]);
  return (
    <html lang="fr">
      <body className="min-h-screen font-sans">
        <div className="flex min-h-screen">
          <Sidebar mode={settings?.mode ?? "api"} pendingManual={pendingManual} />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
