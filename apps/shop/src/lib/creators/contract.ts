import type { CreatorsSettings } from "@/lib/schemas/settings";
import { formatPrice } from "@/lib/utils";
import { formatPoints, formatRate } from "./settings";

/**
 * Contrat créatrice, versionné dans le code. Toute modification du texte doit changer
 * CONTRACT_VERSION : les créatrices devront alors accepter la nouvelle version (date et
 * adresse IP enregistrées) avant de pouvoir proposer de nouvelles idées.
 */
export const CONTRACT_VERSION = "2026-11-v1";
export const CONTRACT_TITLE = "Contrat créatrice — La Malle à Jeux";

/** Mention affichée uniquement dans l'administration (jamais aux créatrices). */
export const CONTRACT_ADMIN_NOTICE = "Modèle à faire valider par un professionnel du droit";

export interface ContractSection { title: string; paragraphs: string[] }

export function contractSections(s: CreatorsSettings): ContractSection[] {
  const threshold = formatPrice(s.payoutThresholdCents);
  return [
    {
      title: "1. L'objet",
      paragraphs: [
        "Vous proposez à La Malle à Jeux des idées d'activités à faire avec les enfants (texte, astuces, photos de votre réalisation). Si une idée est retenue, notre studio la transforme en petit tutoriel illustré vendu sur la boutique, et vous touchez une part de chaque vente.",
        "Le programme est ouvert sur invitation pendant la phase de test.",
      ],
    },
    {
      title: "2. Ce que vous garantissez",
      paragraphs: [
        "L'idée, les textes et les photos que vous envoyez sont les vôtres : vous ne les avez pas copiés et vous avez le droit de les partager.",
        "Photos d'enfants : aucun visage reconnaissable, sauf autorisation écrite des deux parents que vous pourrez nous transmettre sur demande. Nous recommandons « mains et réalisation uniquement ».",
        "Vous signalez toute étape à risque (verre, chaleur, outils, petites pièces avant 3 ans…) : elle portera la mention « avec un adulte » et des consignes de sécurité.",
      ],
    },
    {
      title: "3. Ce que vous nous autorisez à faire",
      paragraphs: [
        "Vendre le tutoriel tiré de votre idée sur la boutique et sur nos canaux de vente.",
        "L'adapter : réécrire le texte, créer des illustrations dans le style La Malle à Jeux, mettre en page, traduire. Vos photos peuvent servir de référence et apparaître dans le livre (« la réalisation de … »).",
        "En faire la promotion (réseaux sociaux, publicités, newsletter) en citant votre pseudo.",
        "Vous validez l'aperçu du tutoriel avant sa mise en vente.",
      ],
    },
    {
      title: "4. Votre rémunération",
      paragraphs: [
        "Base de calcul : le montant réellement encaissé, c'est-à-dire le prix hors taxes payé par le client, après remise éventuelle, moins les frais de paiement estimés et les remboursements.",
        `Taux : ${formatRate(s.ideaRateBp)} pour une idée avec quelques photos, ${formatRate(s.fullTutorialRateBp)} pour un tutoriel complet avec vos photos des étapes${s.exclusivityBonusBp > 0 ? `, plus ${formatPoints(s.exclusivityBonusBp)} si vous accordez l'exclusivité à La Malle à Jeux` : ""}. Le taux retenu est indiqué lors de l'acceptation de votre idée.`,
        "Packs : si votre tutoriel fait partie d'un pack, vous touchez votre part au prorata du prix des produits du pack.",
        `Chaque vente crée une commission « en attente ». Elle est confirmée après ${s.confirmationDelayDays} jours (délai de remboursement) ; un remboursement l'annule ou la réduit.`,
        "Aucune commission sur vos propres achats.",
      ],
    },
    {
      title: "5. Le paiement",
      paragraphs: [
        `Les commissions confirmées sont payées une fois par mois par virement, dès qu'elles atteignent ${threshold}. En dessous, elles sont reportées au mois suivant.`,
        "Votre IBAN est chiffré et n'est jamais affiché en clair, ni à vous ni dans nos écrans.",
        "Vous êtes responsable de la déclaration de ces revenus selon votre situation (particulier, micro-entrepreneur…). La plateforme peut être tenue de déclarer chaque année les revenus versés à l'administration fiscale (obligation européenne DAC7) : nous vous demanderons alors les informations nécessaires.",
      ],
    },
    {
      title: "6. Exclusivité, durée et retrait",
      paragraphs: [
        "L'exclusivité est facultative et choisie idée par idée. Si vous l'accordez, vous vous engagez à ne pas vendre ni céder le même tutoriel à une autre boutique tant qu'il est en vente chez nous.",
        "Le contrat dure tant qu'un de vos tutoriels est en vente. Vous pouvez demander le retrait d'un tutoriel du catalogue à tout moment par e-mail : il est retiré dans un délai de 30 jours. Les clients qui l'ont déjà acheté le conservent, et les commissions des ventes déjà réalisées restent dues.",
        "Nous pouvons refuser une idée, retirer un tutoriel ou suspendre votre compte en cas de non-respect de ce contrat (contenu copié, photo d'enfant non autorisée, fraude).",
      ],
    },
    {
      title: "7. Vos données",
      paragraphs: [
        "Nous conservons votre nom, votre e-mail, votre IBAN (chiffré) et l'historique de vos commissions pour gérer le programme et nos obligations comptables. Votre nom et votre e-mail ne sont jamais publiés : seul votre pseudo apparaît sur la boutique.",
        "En acceptant ce contrat, la date et l'adresse IP de votre acceptation sont enregistrées.",
      ],
    },
  ];
}

/** Texte brut (export, e-mail, journal d'acceptation). */
export function contractPlainText(s: CreatorsSettings): string {
  return [CONTRACT_TITLE, `Version ${CONTRACT_VERSION}`, "", ...contractSections(s).flatMap((sec) => [sec.title, ...sec.paragraphs, ""])].join("\n");
}
