import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** Avertit quand le générateur de démonstration est actif : le contenu produit ne tient pas compte du brief. */
export function DemoModeBanner({ text, images, keys }: { text: boolean; images: boolean; keys: { anthropic: boolean; openai: boolean } }) {
  if (!text && !images) return null;
  const what = text && images ? "le texte et les images" : text ? "le texte" : "les images";
  return (
    <div role="alert" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Mode démonstration actif pour {what}</p>
      <p className="mt-1">
        Le générateur de démonstration produit toujours le même contenu factice (marqué « [DÉMO] ») et <strong>ignore votre brief</strong>.
        Pour une vraie génération, ouvrez <Link href="/settings" className="underline font-semibold">Paramètres → IA</Link> et choisissez{" "}
        {text ? (keys.anthropic ? "Claude pour le texte" : "le mode copier-coller, ou ajoutez la clé ANTHROPIC_API_KEY") : null}
        {text && images ? " ; " : ""}
        {images ? (keys.openai ? "GPT Image pour les images" : "le mode copier-coller pour les images, ou ajoutez la clé OPENAI_API_KEY") : null}.
      </p>
    </div>
  );
}
