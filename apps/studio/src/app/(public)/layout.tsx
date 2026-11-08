import "../globals.css";

/** Pages publiques (lien d'aperçu partagé) : sans menu du studio. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-50 font-sans">{children}</body>
    </html>
  );
}
