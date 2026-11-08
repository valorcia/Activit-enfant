import Link from "next/link";

/** Rappelle quel univers les réglages de la page modifient. */
export function SiteTargetNotice({ site, explicit, scope = "appearance" }: { site: { name: string; slug: string }; explicit: boolean; scope?: "appearance" | "settings" }) {
  return (
    <div className="mb-4 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
      <p><span className="font-bold">Univers : {site.name}</span>{explicit ? "" : " (univers par défaut)"}</p>
      <p className="mt-0.5 text-xs text-ink-soft">
        {explicit
          ? "Les changements ne s'appliquent qu'à cet univers."
          : "« Tous les univers » est sélectionné : l'identité (marque, thème, SEO, analytics, conversion) modifiée ici est celle de l'univers par défaut."}
        {scope === "settings" && (explicit ? " L'onglet Commerce surcharge les réglages communs pour cet univers ; les clés d'intégration restent communes à la plateforme." : " L'onglet Commerce modifie les réglages communs à tous les univers ; les clés d'intégration sont communes.")}
        {" "}Changez d&apos;univers avec le sélecteur du menu, ou gérez-les dans <Link href="/admin/univers" className="font-semibold underline">Univers & domaines</Link>.
      </p>
    </div>
  );
}
