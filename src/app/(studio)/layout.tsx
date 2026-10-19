import type { Metadata } from "next";
import "../globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Inventor Studio",
  description: "Studio IA de création de livres d'activités pour enfants",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
