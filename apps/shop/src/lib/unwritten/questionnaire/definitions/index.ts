import type { z } from "zod";
import type { CollectionKey } from "../../constants";
import type { definitionSchema } from "../schema";

/**
 * Définitions de départ des trois collections (version 1, créées par le seed si absentes).
 * Sobriété : 5 à 8 questions visibles par parcours. Les champs sensibles sont facultatifs.
 * Minimisation : prénoms seulement, tranches d'âge plutôt que dates de naissance pour les enfants.
 * Ensuite, les définitions se modifient dans l'admin (JSON validé), sans changement de code.
 */
type DefinitionInput = z.input<typeof definitionSchema>;
const t = (en: string, fr: string) => ({ en, fr });
const n = " ";

const dedication = {
  id: "dedication",
  type: "longtext" as const,
  audience: "buyer" as const,
  maxLength: 400,
  label: t("A dedication for the first page", "Une dédicace pour la première page"),
  help: t("A few words, signed as you like. Leave it empty if you prefer.", "Quelques mots, signés comme vous le souhaitez. Laissez vide si vous préférez."),
};

export const secretBook: DefinitionInput = {
  schemaVersion: 1,
  intro: t("A book of small secrets and shared challenges, to open together.", "Un livre de petits secrets et de défis partagés, à ouvrir ensemble."),
  steps: [
    {
      id: "edition",
      title: t("The edition", "L'édition"),
      questions: [
        {
          id: "edition", type: "single", required: true, audience: "buyer",
          label: t("Who is this Secret Book for?", `Pour qui est ce Secret Book${n}?`),
          options: [
            { value: "couple", label: t("A couple", "Un couple") },
            { value: "family", label: t("A family", "Une famille") },
            { value: "friends", label: t("Friends", "Des amis") },
            { value: "growth", label: t("Myself — personal growth", "Moi — développement personnel"), description: t("Reflective, never medical.", "Introspectif, jamais médical.") },
            { value: "adventure", label: t("An adventure", "Une aventure") },
          ],
        },
      ],
    },
    {
      id: "people",
      title: t("The people", "Les personnes"),
      questions: [
        { id: "mainName", type: "text", required: true, maxLength: 40, label: t("Your first name", "Votre prénom"), help: t("First name only: the book uses it in the text.", `Le prénom seulement${n}: le livre l'utilise dans le texte.`) },
        { id: "partnerName", type: "text", required: true, maxLength: 40, label: t("Their first name", "Son prénom"), showIf: { q: "edition", op: "eq", value: "couple" } },
        { id: "groupNames", type: "text", maxLength: 200, label: t("Who else is in the book?", `Qui d'autre est dans le livre${n}?`), help: t("First names, separated by commas.", "Des prénoms, séparés par des virgules."), showIf: { q: "edition", op: "in", value: ["family", "friends", "adventure"] } },
      ],
    },
    {
      id: "story",
      title: t("What makes it yours", "Ce qui le rend unique"),
      questions: [
        { id: "shared", type: "longtext", required: true, maxLength: 600, label: t("Something only you share", "Quelque chose que vous seuls partagez"), help: t("A place, a ritual, a running joke.", "Un lieu, un rituel, une blague qui dure."), showIf: { q: "edition", op: "neq", value: "growth" } },
        {
          id: "intention", type: "single", required: true,
          label: t("What would you like more of?", `De quoi aimeriez-vous davantage${n}?`),
          help: t("This book is not a therapy and gives no medical advice.", "Ce livre n'est pas une thérapie et ne donne aucun conseil médical."),
          showIf: { q: "edition", op: "eq", value: "growth" },
          options: [
            { value: "confidence", label: t("Confidence", "Confiance") },
            { value: "calm", label: t("Calm", "Calme") },
            { value: "creativity", label: t("Creativity", "Créativité") },
            { value: "courage", label: t("Courage", "Courage") },
          ],
        },
        {
          id: "setting", type: "single", required: true,
          label: t("Where should the adventure take place?", `Où doit se dérouler l'aventure${n}?`),
          showIf: { q: "edition", op: "eq", value: "adventure" },
          options: [
            { value: "home", label: t("At home", "À la maison") },
            { value: "city", label: t("In the city", "En ville") },
            { value: "nature", label: t("Outdoors", "En pleine nature") },
            { value: "travel", label: t("On a trip", "En voyage") },
          ],
        },
      ],
    },
    {
      id: "voice",
      title: t("The voice", "La voix"),
      questions: [
        {
          id: "tone", type: "single", required: true,
          label: t("The tone you would like", "Le ton souhaité"),
          options: [
            { value: "tender", label: t("Tender", "Tendre") },
            { value: "playful", label: t("Playful", "Joueur") },
            { value: "bold", label: t("Bold", "Audacieux") },
          ],
        },
        { id: "secret", type: "longtext", sensitive: true, maxLength: 600, label: t("A secret, a wish, something never said", "Un secret, un souhait, quelque chose de jamais dit"), help: t("It will be woven in gently, never quoted as is.", "Il sera évoqué avec délicatesse, jamais cité tel quel.") },
        dedication,
      ],
    },
  ],
};

export const beforeItsTooLate: DefinitionInput = {
  schemaVersion: 1,
  intro: t("Moments to live, questions to ask, while there is still time.", "Des moments à vivre et des questions à poser, tant qu'il est temps."),
  steps: [
    {
      id: "edition",
      title: t("The edition", "L'édition"),
      questions: [
        {
          id: "edition", type: "single", required: true, audience: "buyer",
          label: t("Who would you like to spend this time with?", `Avec qui voulez-vous partager ce temps${n}?`),
          options: [
            { value: "parents", label: t("My parents", "Mes parents") },
            { value: "grandparents", label: t("My grandparents", "Mes grands-parents") },
            { value: "couple", label: t("My partner", "Mon couple") },
            { value: "children", label: t("My children", "Mes enfants") },
            { value: "friends", label: t("My friends", "Mes amis") },
          ],
        },
      ],
    },
    {
      id: "people",
      title: t("The people", "Les personnes"),
      questions: [
        { id: "yourName", type: "text", required: true, maxLength: 40, label: t("Your first name", "Votre prénom") },
        { id: "theirNames", type: "text", required: true, maxLength: 200, label: t("Their first names", "Leurs prénoms"), help: t("Or how you call them: Mum, Grandpa Jo…", `Ou comme vous les appelez${n}: Maman, Papi Jo…`) },
        {
          id: "childrenAge", type: "single", required: true,
          label: t("How old are they?", `Quel âge ont-ils${n}?`),
          help: t("An age range is enough.", "Une tranche d'âge suffit."),
          showIf: { q: "edition", op: "eq", value: "children" },
          options: [
            { value: "0-5", label: t("Under 6", "Moins de 6 ans") },
            { value: "6-11", label: t("6 to 11", "6 à 11 ans") },
            { value: "12-17", label: t("12 to 17", "12 à 17 ans") },
            { value: "adult", label: t("Adults", "Adultes") },
          ],
        },
      ],
    },
    {
      id: "time",
      title: t("Your time together", "Votre temps ensemble"),
      questions: [
        {
          id: "frequency", type: "single", required: true,
          label: t("How often do you see each other?", `À quelle fréquence vous voyez-vous${n}?`),
          options: [
            { value: "together", label: t("We live together", "Nous vivons ensemble") },
            { value: "weekly", label: t("Every week", "Chaque semaine") },
            { value: "yearly", label: t("A few times a year", "Quelques fois par an") },
            { value: "rarely", label: t("Rarely", "Rarement") },
          ],
        },
        { id: "memory", type: "longtext", maxLength: 600, label: t("A memory you already share", "Un souvenir que vous partagez déjà"), help: t("One or two sentences are enough.", "Une ou deux phrases suffisent.") },
        { id: "unsaid", type: "longtext", sensitive: true, maxLength: 600, label: t("Something you have never dared to ask or say", "Quelque chose que vous n'avez jamais osé demander ou dire"), help: t("Private: only used to write your book.", `Confidentiel${n}: sert uniquement à écrire votre livre.`) },
      ],
    },
    { id: "closing", title: t("The first page", "La première page"), questions: [dedication] },
  ],
};

export const movieOfMyLife: DefinitionInput = {
  schemaVersion: 1,
  intro: t("A life told like a film: scenes, places, turning points.", `Une vie racontée comme un film${n}: des scènes, des lieux, des tournants.`),
  steps: [
    {
      id: "film",
      title: t("The film", "Le film"),
      questions: [
        {
          id: "scope", type: "single", required: true, audience: "buyer",
          label: t("What should the film tell?", `Que doit raconter le film${n}?`),
          options: [
            { value: "life", label: t("A whole life", "Toute une vie") },
            { value: "chapter", label: t("One chapter of a life", "Un chapitre d'une vie") },
          ],
        },
        {
          id: "genre", type: "single", required: true,
          label: t("If it were a film, it would be…", "Si c'était un film, ce serait…"),
          options: [
            { value: "drama", label: t("A drama", "Un drame") },
            { value: "comedy", label: t("A comedy", "Une comédie") },
            { value: "epic", label: t("An epic", "Une épopée") },
            { value: "feelgood", label: t("A feel-good film", "Un feel-good") },
          ],
        },
      ],
    },
    {
      id: "hero",
      title: t("The main character", "Le personnage principal"),
      questions: [
        { id: "heroName", type: "text", required: true, maxLength: 40, label: t("Their first name", "Son prénom") },
        { id: "birthYear", type: "date", label: t("Year of birth", "Année de naissance"), help: t("A year is enough: 1958.", `Une année suffit${n}: 1958.`), showIf: { q: "scope", op: "eq", value: "life" } },
        { id: "period", type: "text", required: true, maxLength: 120, label: t("Which chapter?", `Quel chapitre${n}?`), help: t("For example: the Paris years, 1994–2001.", `Par exemple${n}: les années parisiennes, 1994–2001.`), showIf: { q: "scope", op: "eq", value: "chapter" } },
      ],
    },
    {
      id: "scenes",
      title: t("The scenes", "Les scènes"),
      questions: [
        { id: "places", type: "text", required: true, maxLength: 200, label: t("Places that matter", "Les lieux qui comptent"), help: t("Cities, houses, countries.", "Des villes, des maisons, des pays.") },
        { id: "turningPoints", type: "longtext", required: true, maxLength: 800, label: t("Three dates that changed everything", "Trois dates qui ont tout changé"), help: t("A year and one line for each.", "Une année et une ligne pour chacune.") },
        { id: "memory", type: "longtext", sensitive: true, maxLength: 800, label: t("A memory you could tell a hundred times", "Un souvenir que vous pourriez raconter cent fois"), help: t("Told as a memory, never presented as a verified fact.", "Raconté comme un souvenir, jamais présenté comme un fait vérifié.") },
        { id: "anecdote", type: "longtext", maxLength: 600, label: t("An anecdote everyone in the family knows", "Une anecdote que toute la famille connaît") },
        { id: "photosLater", type: "info", label: t("Photos: you will be able to add some later. This option is not available yet.", `Photos${n}: vous pourrez en ajouter plus tard. Cette option n'est pas encore disponible.`) },
      ],
    },
  ],
};

export const STARTER_DEFINITIONS: Record<CollectionKey, DefinitionInput> = {
  "secret-book": secretBook,
  "before-its-too-late": beforeItsTooLate,
  "movie-of-my-life": movieOfMyLife,
};
