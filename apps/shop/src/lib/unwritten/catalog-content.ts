import { z } from "zod";
import { pageRange } from "./book-plan";
import type { CollectionKey } from "./constants";

/**
 * Textes bilingues d'un produit personnalisé (`PersonalizedProduct.content`), validés par Zod.
 * Les éditions correspondent aux options de la première question du questionnaire.
 * Aucun avis, chiffre de vente ou témoignage : uniquement la description de ce que contient le livre.
 */
const localizedProduct = z.object({
  name: z.string().min(1).max(80),
  tagline: z.string().min(1).max(160),
  description: z.string().min(1).max(600),
  collectionLead: z.string().min(1).max(600),
  story: z.array(z.string().max(800)).max(6).default([]),
  editions: z.array(z.object({ key: z.string().max(40), label: z.string().max(60), text: z.string().max(240) })).max(8).default([]),
  inside: z.array(z.string().max(200)).max(8).default([]),
  faq: z.array(z.object({ q: z.string().max(200), a: z.string().max(800) })).max(10).default([]),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(170).optional(),
});
export type LocalizedProductContent = z.infer<typeof localizedProduct>;

export const productContentSchema = z.object({ en: localizedProduct, fr: localizedProduct });
export type ProductContent = z.infer<typeof productContentSchema>;

/** Prix fixés par devise, en centimes TTC (pas de conversion à la volée). */
export const pricesSchema = z.record(z.string().regex(/^[A-Z]{3}$/), z.number().int().min(50).max(1_000_000));

const n = " ";

export interface StarterProduct {
  key: CollectionKey;
  slug: string;
  priceCents: number;
  pagesMin: number;
  pagesMax: number;
  position: number;
  content: ProductContent;
}

/**
 * Version des textes de départ : le seed met à jour les produits jamais modifiés dans l'admin
 * lorsque cette version augmente (voir seed.ts).
 */
export const STARTER_CONTENT_VERSION = 2;

/** Les trois collections du pilote. Prix configurables ensuite dans l'admin ; pages = plan du livre. */
export const STARTER_PRODUCTS: StarterProduct[] = [
  {
    key: "secret-book",
    slug: "the-secret-book",
    priceCents: 1990,
    pagesMin: pageRange("secret-book").min,
    pagesMax: pageRange("secret-book").max,
    position: 1,
    content: {
      en: {
        name: "The Secret Book",
        tagline: "Small secrets and shared challenges, written for the two of you, or for the whole group.",
        description: "A book to open together, page by page: challenges to live, questions to answer, small secrets to uncover. Written from your first names, your rituals and the tone you choose.",
        collectionLead: "The Secret Book turns what you already share into something to discover again: a ritual, a place, a joke that never gets old.",
        story: [
          "Some books are read alone. This one is opened together.",
          "Each page holds a challenge, a question or a small secret, written for the people in it. Nothing generic: your rituals, your places, the way you speak to each other.",
        ],
        editions: [
          { key: "couple", label: "Couple", text: "For two: what you share, and what you have never said." },
          { key: "family", label: "Family", text: "For a family table: challenges to live across generations." },
          { key: "friends", label: "Friends", text: "For a group of friends, its jokes and its legends." },
          { key: "growth", label: "Personal growth", text: "For yourself: reflective challenges, never medical advice." },
          { key: "adventure", label: "Adventure", text: "A story where you are the characters, at home or on the road." },
        ],
        inside: ["Your portrait, with up to 4 of your photos", "Twelve to sixteen challenges to live together", "Questions to answer in turn", "Pages to complete by hand", "A dedication on the first page"],
        faq: [
          { q: "Who is it for?", a: "For a couple, a family, friends, or for yourself. You choose the edition when you begin." },
          { q: "Can I add photos?", a: "Yes, up to 4. They illustrate your portrait at the start of the book. They stay private and are used only for your book." },
          { q: "Is the personal growth edition a therapy?", a: "No. It offers reflective challenges and never gives medical or psychological advice." },
        ],
        seoTitle: "The Secret Book — a personalised book of shared secrets",
        seoDescription: "A personalised digital book of challenges and small secrets, written from your answers. For couples, families, friends or yourself.",
      },
      fr: {
        name: "The Secret Book",
        tagline: "Des petits secrets et des défis partagés, écrits pour vous deux, ou pour toute la bande.",
        description: `Un livre à ouvrir ensemble, page après page${n}: des défis à vivre, des questions auxquelles répondre, des petits secrets à découvrir. Écrit à partir de vos prénoms, de vos rituels et du ton que vous choisissez.`,
        collectionLead: `The Secret Book transforme ce que vous partagez déjà en quelque chose à redécouvrir${n}: un rituel, un lieu, une blague qui ne s'use pas.`,
        story: [
          "Certains livres se lisent seul. Celui-ci s'ouvre à plusieurs.",
          `Chaque page contient un défi, une question ou un petit secret, écrit pour les personnes qui s'y trouvent. Rien de générique${n}: vos rituels, vos lieux, votre façon de vous parler.`,
        ],
        editions: [
          { key: "couple", label: "Couple", text: `À deux${n}: ce que vous partagez, et ce que vous ne vous êtes jamais dit.` },
          { key: "family", label: "Famille", text: `Pour la tablée familiale${n}: des défis à vivre entre générations.` },
          { key: "friends", label: "Amis", text: "Pour une bande d'amis, ses blagues et ses légendes." },
          { key: "growth", label: "Développement personnel", text: `Pour vous${n}: des défis introspectifs, jamais de conseil médical.` },
          { key: "adventure", label: "Aventure", text: "Une histoire dont vous êtes les personnages, à la maison ou en chemin." },
        ],
        inside: ["Votre portrait, avec jusqu'à 4 de vos photos", "Douze à seize défis à vivre ensemble", "Des questions auxquelles répondre à tour de rôle", "Des pages à compléter à la main", "Une dédicace en première page"],
        faq: [
          { q: `Pour qui est-il${n}?`, a: "Pour un couple, une famille, des amis, ou pour vous-même. Vous choisissez l'édition au début." },
          { q: `Puis-je ajouter des photos${n}?`, a: "Oui, jusqu'à 4. Elles illustrent votre portrait en début de livre. Elles restent privées et servent uniquement à votre livre." },
          { q: `L'édition développement personnel est-elle une thérapie${n}?`, a: "Non. Elle propose des défis introspectifs et ne donne jamais de conseil médical ou psychologique." },
        ],
        seoTitle: "The Secret Book — un livre personnalisé de secrets partagés",
        seoDescription: "Un livre numérique personnalisé de défis et de petits secrets, écrit à partir de vos réponses. Pour un couple, une famille, des amis ou vous-même.",
      },
    },
  },
  {
    key: "before-its-too-late",
    slug: "before-its-too-late",
    priceCents: 2490,
    pagesMin: pageRange("before-its-too-late").min,
    pagesMax: pageRange("before-its-too-late").max,
    position: 2,
    content: {
      en: {
        name: "Before It's Too Late",
        tagline: "The moments to live and the questions to ask, while there is still time.",
        description: "A book of experiences to share and conversations to have with the people who matter: your parents, your grandparents, your partner, your children, your friends.",
        collectionLead: "We always think there will be time. Before It's Too Late is a gentle way of not waiting.",
        story: [
          "The questions we never asked our grandparents. The trip we keep postponing. The words we assume are understood.",
          "This book gathers them, written for the people you name, with room to write down what happens.",
        ],
        editions: [
          { key: "parents", label: "Parents", text: "Questions and moments to share with your parents." },
          { key: "grandparents", label: "Grandparents", text: "Their stories, in their words, before they are lost." },
          { key: "couple", label: "Couple", text: "The things you keep for later, lived now." },
          { key: "children", label: "Children", text: "Moments to live with your children, adapted to their age." },
          { key: "friends", label: "Friends", text: "For the friends who have been there all along." },
        ],
        inside: ["A portrait of the people you name, with your photos together", "Twenty questions to ask, and space for the answers", "Ten experiences to live together, each with its page", "A photo album, with frames for the moments to come", "A dedication on the first page"],
        faq: [
          { q: "Do I need to share personal memories?", a: "No. A few first names and your answers are enough. Sensitive questions are optional." },
          { q: "Can I add photos?", a: "Yes, up to 12: four for the portrait and eight for the album at the end of the book. They stay private and are used only for your book." },
          { q: "Can the whole family contribute?", a: "Not yet. Inviting relatives to add a memory is planned for a later version." },
        ],
        seoTitle: "Before It's Too Late — a personalised book of moments to share",
        seoDescription: "A personalised digital book of experiences and questions to share with your parents, grandparents, partner, children or friends.",
      },
      fr: {
        name: "Before It's Too Late",
        tagline: "Les moments à vivre et les questions à poser, tant qu'il est temps.",
        description: `Un livre d'expériences à partager et de conversations à avoir avec ceux qui comptent${n}: vos parents, vos grands-parents, votre couple, vos enfants, vos amis.`,
        collectionLead: "On croit toujours qu'on aura le temps. Before It's Too Late est une manière douce de ne pas attendre.",
        story: [
          "Les questions jamais posées aux grands-parents. Le voyage toujours repoussé. Les mots qu'on croit compris.",
          "Ce livre les rassemble, écrits pour les personnes que vous nommez, avec la place d'y noter ce qui se passe.",
        ],
        editions: [
          { key: "parents", label: "Parents", text: "Des questions et des moments à partager avec vos parents." },
          { key: "grandparents", label: "Grands-parents", text: "Leurs histoires, dans leurs mots, avant qu'elles ne se perdent." },
          { key: "couple", label: "Couple", text: "Ce que vous gardez pour plus tard, vécu maintenant." },
          { key: "children", label: "Enfants", text: "Des moments à vivre avec vos enfants, adaptés à leur âge." },
          { key: "friends", label: "Amis", text: "Pour les amis qui sont là depuis toujours." },
        ],
        inside: ["Un portrait des personnes que vous nommez, avec vos photos ensemble", "Vingt questions à poser, et la place pour les réponses", "Dix expériences à vivre ensemble, chacune avec sa page", "Un album photo, avec des cadres pour les moments à venir", "Une dédicace en première page"],
        faq: [
          { q: `Faut-il partager des souvenirs personnels${n}?`, a: "Non. Quelques prénoms et vos réponses suffisent. Les questions sensibles sont facultatives." },
          { q: `Puis-je ajouter des photos${n}?`, a: "Oui, jusqu'à 12${n}: quatre pour le portrait et huit pour l'album en fin de livre. Elles restent privées et servent uniquement à votre livre." },
          { q: `Toute la famille peut-elle participer${n}?`, a: "Pas encore. L'invitation de proches à ajouter un souvenir est prévue dans une prochaine version." },
        ],
        seoTitle: "Before It's Too Late — un livre personnalisé de moments à partager",
        seoDescription: "Un livre numérique personnalisé d'expériences et de questions à partager avec vos parents, grands-parents, votre couple, vos enfants ou vos amis.",
      },
    },
  },
  {
    key: "movie-of-my-life",
    slug: "the-movie-of-my-life",
    priceCents: 3990,
    pagesMin: pageRange("movie-of-my-life").min,
    pagesMax: pageRange("movie-of-my-life").max,
    position: 3,
    content: {
      en: {
        name: "The Movie of My Life",
        tagline: "A life told like a film: its scenes, its places, its turning points.",
        description: "The story of a life, or of one chapter of it, written as a film in scenes. Built from places, dates, memories and the anecdotes everyone knows.",
        collectionLead: "Every life has its opening scene, its turning points and its credits. The Movie of My Life writes them down.",
        story: [
          "Some lives deserve a screenplay. This book is the closest thing to one.",
          "Memories are written as memories, never presented as verified facts. The places and dates you give become the scenes.",
        ],
        editions: [
          { key: "life", label: "A whole life", text: "From the opening scene to today." },
          { key: "chapter", label: "One chapter", text: "A period that changed everything: a city, a decade, an encounter." },
        ],
        inside: ["Seven chapters written as scenes, from your answers", "Up to 22 of your photos, each in the matching chapter, and one on the cover", "Places, encounters and turning points", "Closing credits with everyone named in the book", "Blank pages for the family to add their own scenes"],
        faq: [
          { q: "Can I add photos?", a: "Yes, up to 22: one for the cover and up to four per chapter (childhood, encounters, places…). They stay private and are used only for your book." },
          { q: "How many pages?", a: "Between 72 and 88 pages, depending on the length of your answers: seven chapters of 7 to 11 pages, plus the opening pages, the closing credits and the family pages." },
          { q: "What if a memory is not exact?", a: "It is written as a memory (\"you often tell that…\"), never presented as a verified fact." },
        ],
        seoTitle: "The Movie of My Life — a personalised life story book",
        seoDescription: "A personalised digital book telling a life, or one chapter of it, like a film: scenes, places, dates and memories.",
      },
      fr: {
        name: "The Movie of My Life",
        tagline: `Une vie racontée comme un film${n}: ses scènes, ses lieux, ses tournants.`,
        description: "L'histoire d'une vie, ou d'un de ses chapitres, écrite comme un film en scènes. À partir des lieux, des dates, des souvenirs et des anecdotes que tout le monde connaît.",
        collectionLead: "Chaque vie a sa scène d'ouverture, ses tournants et son générique. The Movie of My Life les écrit.",
        story: [
          "Certaines vies mériteraient un scénario. Ce livre en est ce qui s'en approche le plus.",
          "Les souvenirs sont écrits comme des souvenirs, jamais présentés comme des faits vérifiés. Les lieux et les dates que vous donnez deviennent les scènes.",
        ],
        editions: [
          { key: "life", label: "Toute une vie", text: "De la scène d'ouverture à aujourd'hui." },
          { key: "chapter", label: "Un chapitre", text: `Une période qui a tout changé${n}: une ville, une décennie, une rencontre.` },
        ],
        inside: ["Sept chapitres écrits comme des scènes, à partir de vos réponses", "Jusqu'à 22 de vos photos, chacune dans le chapitre correspondant, et une en couverture", "Les lieux, les rencontres et les tournants", "Un générique de fin avec toutes les personnes citées", "Des pages libres pour que la famille ajoute ses propres scènes"],
        faq: [
          { q: `Puis-je ajouter des photos${n}?`, a: `Oui, jusqu'à 22${n}: une pour la couverture et jusqu'à quatre par chapitre (enfance, rencontres, lieux…). Elles restent privées et servent uniquement à votre livre.` },
          { q: `Combien de pages${n}?`, a: `Entre 72 et 88 pages selon la longueur de vos réponses${n}: sept chapitres de 7 à 11 pages, plus les pages d'ouverture, le générique de fin et les pages de la famille.` },
          { q: `Et si un souvenir n'est pas exact${n}?`, a: `Il est écrit comme un souvenir («${n}tu racontes souvent que…${n}»), jamais présenté comme un fait vérifié.` },
        ],
        seoTitle: "The Movie of My Life — le livre personnalisé d'une vie",
        seoDescription: `Un livre numérique personnalisé qui raconte une vie, ou un de ses chapitres, comme un film${n}: scènes, lieux, dates et souvenirs.`,
      },
    },
  },
];
