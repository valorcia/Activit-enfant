import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPage } from "@/lib/pages";
import { StaticPageView } from "@/components/storefront/static-page-view";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";

export const revalidate = 600;
export const metadata: Metadata = { title: "Questions fréquentes", description: "Tout savoir sur nos kits à imprimer : téléchargement, impression, paiement et accès à vos fichiers." };

const DEFAULT_FAQ = [
  { q: "Comment recevoir mes fichiers ?", a: "Dès la confirmation du paiement par Stripe, vous recevez un email avec vos liens de téléchargement. Ils sont aussi affichés sur la page de confirmation." },
  { q: "Dois-je créer un compte ?", a: "Non. Vos achats sont liés à votre adresse email : la page « Retrouver mes achats » vous renvoie un lien sécurisé à tout moment." },
  { q: "Quel format et comment imprimer ?", a: "Les kits sont fournis en PDF, prêts à imprimer sur une imprimante domestique au format A4." },
  { q: "Quels moyens de paiement acceptez-vous ?", a: "Carte bancaire, Apple Pay et Google Pay via Stripe, de manière entièrement sécurisée. Nous ne stockons jamais vos données bancaires." },
  { q: "Puis-je me rétracter après l'achat ?", a: "S'agissant d'un contenu numérique fourni immédiatement, le droit de rétractation ne s'applique plus une fois le téléchargement commencé, conformément à la réglementation en vigueur. En cas de problème, contactez-nous : nous trouvons toujours une solution." },
];

export default async function FaqPage() {
  const page = await getPublishedPage("faq");
  if (page) return <StaticPageView page={page} />;
  return (
    <div className="container-shell max-w-3xl py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Questions fréquentes" }]} className="mb-6" />
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">Questions fréquentes</h1>
      <div className="card-soft mt-6 px-6">
        <Accordion type="single" collapsible>
          {DEFAULT_FAQ.map((f, i) => (
            <AccordionItem key={i} value={`q${i}`}><AccordionTrigger>{f.q}</AccordionTrigger><AccordionContent>{f.a}</AccordionContent></AccordionItem>
          ))}
        </Accordion>
      </div>
      <p className="mt-6 text-sm text-ink-soft">Une autre question ? <Link href="/contact" className="font-bold underline">Contactez-nous</Link>.</p>
    </div>
  );
}
