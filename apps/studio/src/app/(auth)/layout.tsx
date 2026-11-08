import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = { title: "Connexion · Inventor Studio", robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen font-sans bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
