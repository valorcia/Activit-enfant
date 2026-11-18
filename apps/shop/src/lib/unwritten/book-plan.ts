import type { CollectionKey, Locale } from "./constants";
import { isAnswered, photoEntries, type Answers } from "./questionnaire/engine";

/**
 * Plan de chaque livre (référence unique) : chapitres, nombre de pages, emplacements photo et
 * questions qui nourrissent chaque chapitre. Il sert à la fiche produit (« ce que contient votre
 * livre »), au questionnaire (« votre livre se construit »), au récapitulatif avant paiement et,
 * côté studio, de cahier des charges à la génération : le nombre de pages annoncé est celui-ci.
 *
 * Aucune IA ici : le plan est déterministe, calculé à partir de l'édition et des réponses.
 * Les identifiants de questions sont ceux des questionnaires de départ (version 2) ; une question
 * inconnue (définition modifiée dans l'admin) est simplement ignorée.
 */

type L = { en: string; fr: string };
const t = (en: string, fr: string): L => ({ en, fr });

export interface ChapterSpec {
  key: string;
  kind: "front" | "chapter" | "back";
  title: L;
  /** Ce que contient le chapitre, en une ou deux phrases. */
  what: L;
  pages: [number, number];
  /** Question « photos » dont les images sont placées dans ce chapitre. */
  photos?: { question: string; max: number };
  /** Questions qui nourrissent l'écriture du chapitre (avancement dans le questionnaire). */
  sources?: string[];
  /** Questions dont la réponse courte est rappelée dans le plan (lieux, prénoms…). */
  highlights?: string[];
  /** Éditions concernées (toutes si absent). */
  editions?: string[];
  /** Titre propre à une édition. */
  titleBy?: Record<string, L>;
  whatBy?: Record<string, L>;
}

export interface Blueprint {
  /** Question qui choisit l'édition (première question du questionnaire). */
  editionQuestion: string;
  defaultEdition: string;
  chapters: ChapterSpec[];
}

const opening = (what: L, pages: [number, number] = [6, 8], extra: Partial<ChapterSpec> = {}): ChapterSpec => ({
  key: "opening", kind: "front", title: t("Opening pages", "Les pages d'ouverture"), what, pages, sources: ["dedication"], ...extra,
});

export const BLUEPRINTS: Record<CollectionKey, Blueprint> = {
  "movie-of-my-life": {
    editionQuestion: "scope",
    defaultEdition: "life",
    chapters: [
      opening(t("Cover with your photo, title page, dedication, contents, and the opening credits: who this film is about, and why it is being told.", "Couverture avec votre photo, page de titre, dédicace, sommaire et générique de début : de qui parle ce film, et pourquoi on le raconte."), [6, 8], { photos: { question: "coverPhoto", max: 1 }, sources: ["heroName", "dedication", "portrait"] }),
      { key: "childhood", kind: "chapter", editions: ["life"], title: t("The first images", "Les premières images"), what: t("Childhood: the house, the family, the first memories, told as scenes.", "L'enfance : la maison, la famille, les premiers souvenirs, racontés comme des scènes."), pages: [9, 11], photos: { question: "childhoodPhotos", max: 4 }, sources: ["birthPlace", "family", "childhoodMemory"], highlights: ["birthPlace"] },
      { key: "youth", kind: "chapter", editions: ["life"], title: t("The age of possibilities", "L'âge des possibles"), what: t("Youth: studies, first jobs, first departures, the friends of that time.", "La jeunesse : les études, les premiers emplois, les premiers départs, les amis de cette époque."), pages: [9, 11], photos: { question: "youthPhotos", max: 3 }, sources: ["youth", "firstSteps"] },
      { key: "setting", kind: "chapter", editions: ["chapter"], title: t("The setting", "Le décor"), what: t("Where and when the story begins: the place, the era, the life before.", "Où et quand commence l'histoire : le lieu, l'époque, la vie d'avant."), pages: [9, 11], photos: { question: "settingPhotos", max: 3 }, sources: ["period", "before"], highlights: ["period"] },
      { key: "heart", kind: "chapter", editions: ["chapter"], title: t("The heart of the story", "Le cœur de l'histoire"), what: t("What happened during this chapter, season after season: the arrivals, the trials, the joys.", "Ce qui s'est passé pendant ce chapitre, saison après saison : les arrivées, les épreuves, les joies."), pages: [9, 11], photos: { question: "heartPhotos", max: 3 }, sources: ["heart"] },
      { key: "people", kind: "chapter", title: t("The encounters", "Les rencontres"), what: t("The people who count: a love story, friendships, the family that grew.", "Les personnes qui comptent : une histoire d'amour, des amitiés, la famille qui s'agrandit."), pages: [9, 11], photos: { question: "peoplePhotos", max: 4 }, sources: ["people", "loveStory"], highlights: ["people"] },
      { key: "places", kind: "chapter", title: t("The sets", "Les décors"), what: t("The places that matter, described as film sets: cities, houses, countries.", "Les lieux qui comptent, décrits comme des décors de cinéma : villes, maisons, pays."), pages: [7, 9], photos: { question: "placesPhotos", max: 4 }, sources: ["places"], highlights: ["places"] },
      { key: "scenes", kind: "chapter", title: t("The big scenes", "Les grandes scènes"), what: t("Three turning points, each written as a scene, with its date and its consequence.", "Trois tournants, chacun écrit comme une scène, avec sa date et ce qu'il a changé."), pages: [9, 11], sources: ["turningPoints", "memory"] },
      { key: "work", kind: "chapter", title: t("Work and passions", "Le métier, les passions"), what: t("What filled the days: a trade, a craft, a passion, the pride that comes with it.", "Ce qui a rempli les journées : un métier, un savoir-faire, une passion, la fierté qui va avec."), pages: [7, 9], photos: { question: "workPhotos", max: 3 }, sources: ["work", "passions"], highlights: ["passions"] },
      { key: "today", kind: "chapter", title: t("Today", "Aujourd'hui"), titleBy: { chapter: t("What remains", "Ce qui reste") }, what: t("Where the film stands today, what is passed on, and the anecdote everyone knows.", "Où en est le film aujourd'hui, ce qui se transmet, et l'anecdote que tout le monde connaît."), pages: [9, 11], photos: { question: "todayPhotos", max: 3 }, sources: ["today", "legacy", "anecdote"] },
      { key: "credits", kind: "back", title: t("Closing credits and family pages", "Générique de fin et pages de la famille"), what: t("The cast of the film (everyone named in the book), then pages left blank for the family to add their own scenes.", "La distribution du film (toutes les personnes citées), puis des pages laissées libres pour que la famille ajoute ses propres scènes."), pages: [7, 7] },
    ],
  },

  "before-its-too-late": {
    editionQuestion: "edition",
    defaultEdition: "grandparents",
    chapters: [
      opening(t("Title page, dedication, contents, and a short letter: why this book, why now.", "Page de titre, dédicace, sommaire et une courte lettre : pourquoi ce livre, pourquoi maintenant."), [5, 5], { sources: ["dedication", "why"] }),
      { key: "portrait", kind: "chapter", title: t("You, as I see you", "Vous, tels que je vous vois"), what: t("A portrait of the people you name: what you know of them, what you love about them, with your photos together.", "Un portrait des personnes que vous nommez : ce que vous savez d'elles, ce que vous aimez chez elles, avec vos photos ensemble."), pages: [4, 4], photos: { question: "togetherPhotos", max: 4 }, sources: ["theirNames", "portrait", "loves"], highlights: ["theirNames"] },
      { key: "questions", kind: "chapter", title: t("The questions never asked", "Les questions jamais posées"), what: t("Twenty questions written for them, on the themes you choose, with space to write down their answers.", "Vingt questions écrites pour eux, sur les thèmes que vous choisissez, avec la place d'y noter leurs réponses."), pages: [10, 10], sources: ["topics", "unsaid"] },
      { key: "moments", kind: "chapter", title: t("The moments to live", "Les moments à vivre"), what: t("Ten experiences to share, adapted to how often you see each other and to any constraint, each with a page to tell how it went.", "Dix expériences à partager, adaptées à votre fréquence de rencontre et à vos contraintes, chacune avec une page pour raconter comment elle s'est passée."), pages: [12, 12], sources: ["frequency", "ideas", "constraints"] },
      { key: "letter", kind: "chapter", title: t("What I want to tell you", "Ce que je veux vous dire"), what: t("A memory you already share, and the words you have kept for later, written gently.", "Un souvenir que vous partagez déjà, et les mots gardés pour plus tard, écrits avec délicatesse."), pages: [3, 3], sources: ["memory", "message"] },
      { key: "album", kind: "back", title: t("Our album", "Notre album"), what: t("Your photos laid out as an album, then empty frames for the photos of the moments you will live.", "Vos photos mises en page comme un album, puis des cadres vides pour les photos des moments que vous allez vivre."), pages: [6, 6], photos: { question: "albumPhotos", max: 8 } },
    ],
  },

  "secret-book": {
    editionQuestion: "edition",
    defaultEdition: "couple",
    chapters: [
      opening(t("Title page, dedication, contents, and the rules of the game.", "Page de titre, dédicace, sommaire et règles du jeu."), [5, 5], { sources: ["dedication"] }),
      { key: "us", kind: "chapter", title: t("What we are", "Ce que nous sommes"), titleBy: { growth: t("Where I stand", "Où j'en suis"), adventure: t("The characters", "Les personnages") }, what: t("A portrait of the people in the book, built from your rituals, your places and your private jokes, with your photos.", "Un portrait des personnes du livre, à partir de vos rituels, de vos lieux et de vos blagues, avec vos photos."), pages: [4, 5], photos: { question: "usPhotos", max: 4 }, sources: ["mainName", "partnerName", "groupNames", "shared", "places", "jokes"], highlights: ["places"] },
      { key: "challenges", kind: "chapter", title: t("The challenges", "Les défis"), titleBy: { growth: t("The inner challenges", "Les défis intérieurs"), adventure: t("The adventure, in episodes", "L'aventure, en épisodes") }, what: t("Twelve to sixteen challenges written for you, in the categories and the tone you choose, each with space to note when and how you lived it.", "Douze à seize défis écrits pour vous, dans les catégories et le ton choisis, chacun avec la place de noter quand et comment vous l'avez vécu."), whatBy: { adventure: t("A story in episodes where you are the characters; each episode ends with a challenge to live for real.", "Une histoire en épisodes dont vous êtes les personnages ; chaque épisode se termine par un défi à vivre pour de vrai.") }, pages: [12, 16], sources: ["challengeTypes", "tone", "setting", "intention"] },
      { key: "secrets", kind: "chapter", title: t("The secrets", "Les secrets"), what: t("Questions to answer in turn, from light to deep, and the secret you shared, hinted at, never quoted.", "Des questions auxquelles répondre à tour de rôle, des plus légères aux plus profondes, et le secret confié, évoqué sans jamais être cité."), pages: [5, 7], sources: ["secret", "wish"] },
      { key: "finale", kind: "chapter", title: t("The grand finale", "Le grand final"), what: t("A last challenge to live together, and a letter to open later.", "Un dernier défi à vivre ensemble, et une lettre à ouvrir plus tard."), pages: [3, 4], sources: ["wish"] },
      { key: "pages", kind: "back", title: t("Your pages", "Vos pages"), what: t("Free pages for your own secrets, tickets, notes and photos.", "Des pages libres pour vos propres secrets, billets, mots et photos."), pages: [3, 3] },
    ],
  },
};

export interface PlanChapter {
  key: string;
  kind: ChapterSpec["kind"];
  /** Numéro de chapitre (chapitres seulement). */
  number: number | null;
  title: string;
  what: string;
  pagesMin: number;
  pagesMax: number;
  photosMax: number;
  photosAdded: number;
  /** Questions nourrissant ce chapitre : répondues / total (questions existantes seulement). */
  answered: number;
  sources: number;
  /** Rappels courts tirés des réponses (lieux, prénoms…). */
  highlights: string[];
}

export interface BookPlan {
  edition: string;
  chapters: PlanChapter[];
  pagesMin: number;
  pagesMax: number;
  photosMax: number;
  photosAdded: number;
}

function short(v: unknown, max = 70): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * Plan d'un livre pour une édition et des réponses données.
 * `knownQuestions` limite l'avancement aux questions qui existent dans la définition utilisée.
 */
export function bookPlan(key: CollectionKey, opts: { locale: Locale; answers?: Answers; edition?: string | null; knownQuestions?: Iterable<string> }): BookPlan {
  const bp = BLUEPRINTS[key];
  const answers = opts.answers ?? {};
  const fromAnswers = typeof answers[bp.editionQuestion] === "string" ? String(answers[bp.editionQuestion]) : null;
  const edition = opts.edition ?? fromAnswers ?? bp.defaultEdition;
  const known = opts.knownQuestions ? new Set(opts.knownQuestions) : null;
  const exists = (q: string) => !known || known.has(q);
  let n = 0;
  const chapters = bp.chapters
    .filter((c) => !c.editions || c.editions.includes(edition))
    .map<PlanChapter>((c) => {
      const sources = (c.sources ?? []).filter(exists);
      const photosMax = c.photos && exists(c.photos.question) ? c.photos.max : 0;
      return {
        key: c.key,
        kind: c.kind,
        number: c.kind === "chapter" ? ++n : null,
        title: (c.titleBy?.[edition] ?? c.title)[opts.locale],
        what: (c.whatBy?.[edition] ?? c.what)[opts.locale],
        pagesMin: c.pages[0],
        pagesMax: c.pages[1],
        photosMax,
        photosAdded: photosMax ? Math.min(photosMax, photoEntries(answers[c.photos!.question]).length) : 0,
        answered: sources.filter((q) => isAnswered(answers[q])).length,
        sources: sources.length,
        highlights: (c.highlights ?? []).map((q) => short(answers[q])).filter((x): x is string => !!x),
      };
    });
  const sum = (f: (c: PlanChapter) => number) => chapters.reduce((s, c) => s + f(c), 0);
  return { edition, chapters, pagesMin: sum((c) => c.pagesMin), pagesMax: sum((c) => c.pagesMax), photosMax: sum((c) => c.photosMax), photosAdded: sum((c) => c.photosAdded) };
}

/** Fourchette de pages toutes éditions confondues (fiche produit, données du produit). */
export function pageRange(key: CollectionKey): { min: number; max: number } {
  const bp = BLUEPRINTS[key];
  const editions = [...new Set(bp.chapters.flatMap((c) => c.editions ?? []))];
  const plans = (editions.length ? editions : [bp.defaultEdition]).map((e) => bookPlan(key, { locale: "en", edition: e }));
  return { min: Math.min(...plans.map((p) => p.pagesMin)), max: Math.max(...plans.map((p) => p.pagesMax)) };
}
