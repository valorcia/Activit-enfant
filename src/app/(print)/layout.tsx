import "../globals.css";

/** Layout racine des routes d'impression : aucun chrome, rendu fidèle au PDF. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#fff" }}>{children}</body>
    </html>
  );
}
