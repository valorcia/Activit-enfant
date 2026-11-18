import type { z } from "zod";
import type { CollectionKey } from "../../constants";
import type { definitionSchema } from "../schema";

/**
 * Définitions de départ des trois collections (version 2, organisée par chapitre du livre ;
 * voir src/lib/unwritten/book-plan.ts). Chaque étape nourrit un chapitre ; la plupart des
 * questions sont facultatives : plus la réponse est riche, plus le chapitre l'est. Les champs
 * sensibles sont facultatifs. Les photos sont privées et servent uniquement au livre.
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

const photos = (id: string, max: number, label: ReturnType<typeof t>, help?: ReturnType<typeof t>) => ({
  id, type: "photos" as const, maxFiles: max, label,
  help: help ?? t(`Up to ${max} photo${max > 1 ? "s" : ""}, with a caption if you like. Private: used only for your book.`, `Jusqu'à ${max} photo${max > 1 ? "s" : ""}, avec une légende si vous le souhaitez. Privées${n}: elles servent uniquement à votre livre.`),
});

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
      description: t("They appear by their first names throughout the book.", "Ils apparaissent par leur prénom tout au long du livre."),
      questions: [
        { id: "mainName", type: "text", required: true, maxLength: 40, label: t("Your first name", "Votre prénom"), help: t("First name only: the book uses it in the text.", `Le prénom seulement${n}: le livre l'utilise dans le texte.`) },
        { id: "partnerName", type: "text", required: true, maxLength: 40, label: t("Their first name", "Son prénom"), showIf: { q: "edition", op: "eq", value: "couple" } },
        { id: "groupNames", type: "text", maxLength: 200, label: t("Who else is in the book?", `Qui d'autre est dans le livre${n}?`), help: t("First names, separated by commas.", "Des prénoms, séparés par des virgules."), showIf: { q: "edition", op: "in", value: ["family", "friends", "adventure"] } },
        {
          id: "together", type: "single",
          label: t("How long have you known each other?", `Depuis combien de temps vous connaissez-vous${n}?`),
          showIf: { q: "edition", op: "neq", value: "growth" },
          options: [
            { value: "new", label: t("Less than a year", "Moins d'un an") },
            { value: "few", label: t("1 to 5 years", "1 à 5 ans") },
            { value: "long", label: t("5 to 15 years", "5 à 15 ans") },
            { value: "always", label: t("More than 15 years", "Plus de 15 ans") },
          ],
        },
      ],
    },
    {
      id: "story",
      title: t("What makes you unique", "Ce qui vous rend uniques"),
      description: t("Chapter 1 of the book: your portrait.", `Chapitre 1 du livre${n}: votre portrait.`),
      questions: [
        { id: "shared", type: "longtext", required: true, maxLength: 1200, label: t("Something only you share", "Quelque chose que vous seuls partagez"), help: t("A place, a ritual, a running joke. A few sentences are enough.", "Un lieu, un rituel, une blague qui dure. Quelques phrases suffisent."), showIf: { q: "edition", op: "neq", value: "growth" } },
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
        { id: "places", type: "text", maxLength: 200, label: t("Your places", "Vos lieux"), help: t("Where you meet, where you go back to: a café, a beach, a kitchen.", `Là où vous vous retrouvez, là où vous revenez${n}: un café, une plage, une cuisine.`) },
        { id: "jokes", type: "text", maxLength: 300, label: t("A nickname, an expression, a private joke", "Un surnom, une expression, une blague à vous") },
        photos("usPhotos", 4, t("Photos of you", "Des photos de vous"), t("Up to 4. They open the book, in the portrait chapter. Private: used only for your book.", `Jusqu'à 4. Elles ouvrent le livre, dans le chapitre portrait. Privées${n}: elles servent uniquement à votre livre.`)),
      ],
    },
    {
      id: "challenges",
      title: t("The challenges", "Les défis"),
      description: t("Chapter 2: twelve to sixteen challenges written for you.", `Chapitre 2${n}: douze à seize défis écrits pour vous.`),
      questions: [
        {
          id: "challengeTypes", type: "multi", maxChoices: 4,
          label: t("Which kinds of challenges?", `Quels types de défis${n}?`),
          help: t("Up to four. Without a choice, the book mixes them.", "Quatre au plus. Sans choix, le livre les mélange."),
          options: [
            { value: "home", label: t("At home", "À la maison") },
            { value: "outdoors", label: t("Outdoors", "Dehors") },
            { value: "creative", label: t("Creative", "Créatifs") },
            { value: "food", label: t("Cooking", "En cuisine") },
            { value: "travel", label: t("Small trips", "Petites escapades") },
            { value: "kindness", label: t("Small kindnesses", "Petites attentions") },
            { value: "bold", label: t("Bold", "Audacieux") },
            { value: "calm", label: t("Slow and calm", "Lents et calmes") },
          ],
        },
        {
          id: "tone", type: "single", required: true,
          label: t("The tone you would like", "Le ton souhaité"),
          options: [
            { value: "tender", label: t("Tender", "Tendre") },
            { value: "playful", label: t("Playful", "Joueur") },
            { value: "bold", label: t("Bold", "Audacieux") },
          ],
        },
      ],
    },
    {
      id: "voice",
      title: t("The secrets", "Les secrets"),
      description: t("Chapters 3 and 4: the secrets and the grand finale.", `Chapitres 3 et 4${n}: les secrets et le grand final.`),
      questions: [
        { id: "secret", type: "longtext", sensitive: true, maxLength: 600, label: t("A secret, a wish, something never said", "Un secret, un souhait, quelque chose de jamais dit"), help: t("It will be woven in gently, never quoted as is.", "Il sera évoqué avec délicatesse, jamais cité tel quel.") },
        { id: "wish", type: "longtext", maxLength: 600, label: t("A dream to make come true together", "Un rêve à réaliser ensemble"), help: t("It becomes the grand finale.", "Il devient le grand final.") },
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
        { id: "why", type: "longtext", maxLength: 600, label: t("Why this book, now?", `Pourquoi ce livre, maintenant${n}?`), help: t("It becomes the short letter that opens the book.", "Cela devient la courte lettre qui ouvre le livre.") },
      ],
    },
    {
      id: "portrait",
      title: t("You, as I see you", "Vous, tels que je vous vois"),
      description: t("Chapter 1 of the book: their portrait.", `Chapitre 1 du livre${n}: leur portrait.`),
      questions: [
        { id: "portrait", type: "longtext", maxLength: 1200, label: t("How would you describe them?", `Comment les décririez-vous${n}?`), help: t("Their character, their habits, what makes them who they are.", "Leur caractère, leurs habitudes, ce qui fait qu'ils sont eux.") },
        { id: "loves", type: "text", maxLength: 300, label: t("What they love", "Ce qu'ils aiment"), help: t("A dish, a song, a place, a saying.", "Un plat, une chanson, un lieu, une expression.") },
        photos("togetherPhotos", 4, t("Photos of you together", "Des photos de vous ensemble")),
      ],
    },
    {
      id: "questions",
      title: t("The questions never asked", "Les questions jamais posées"),
      description: t("Chapter 2: twenty questions written for them.", `Chapitre 2${n}: vingt questions écrites pour eux.`),
      questions: [
        {
          id: "topics", type: "multi", maxChoices: 5,
          label: t("Which subjects would you like to explore?", `Quels sujets aimeriez-vous aborder${n}?`),
          help: t("Up to five. Without a choice, the book covers a bit of everything.", "Cinq au plus. Sans choix, le livre aborde un peu de tout."),
          options: [
            { value: "childhood", label: t("Their childhood", "Leur enfance") },
            { value: "love", label: t("Love", "L'amour") },
            { value: "work", label: t("Work", "Le travail") },
            { value: "history", label: t("The era they lived through", "L'époque qu'ils ont vécue") },
            { value: "origins", label: t("Family origins", "Les origines de la famille") },
            { value: "values", label: t("What matters to them", "Ce qui compte pour eux") },
            { value: "advice", label: t("Their advice for life", "Leurs conseils de vie") },
            { value: "regrets", label: t("Regrets and pride", "Regrets et fiertés") },
          ],
        },
        { id: "unsaid", type: "longtext", sensitive: true, maxLength: 600, label: t("Something you have never dared to ask or say", "Quelque chose que vous n'avez jamais osé demander ou dire"), help: t("Private: only used to write your book.", `Confidentiel${n}: sert uniquement à écrire votre livre.`) },
      ],
    },
    {
      id: "time",
      title: t("The moments to live", "Les moments à vivre"),
      description: t("Chapter 3: ten experiences adapted to your life.", `Chapitre 3${n}: dix expériences adaptées à votre vie.`),
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
        {
          id: "ideas", type: "multi", maxChoices: 4,
          label: t("What would you like to do together?", `Qu'aimeriez-vous faire ensemble${n}?`),
          help: t("Up to four ideas; the book suggests the rest.", "Quatre idées au plus ; le livre propose le reste."),
          options: [
            { value: "cook", label: t("Cook a family recipe", "Cuisiner une recette de famille") },
            { value: "place", label: t("Go back to a place from the past", "Retourner dans un lieu du passé") },
            { value: "music", label: t("Listen to their songs", "Écouter leurs chansons") },
            { value: "photos", label: t("Sort old photos", "Trier les vieilles photos") },
            { value: "learn", label: t("Learn something from them", "Apprendre quelque chose d'eux") },
            { value: "letters", label: t("Write to each other", "S'écrire") },
            { value: "outdoors", label: t("A day outdoors", "Une journée dehors") },
            { value: "celebrate", label: t("A celebration", "Une fête") },
          ],
        },
        { id: "constraints", type: "text", sensitive: true, maxLength: 200, label: t("Anything to take into account?", `Des contraintes à prendre en compte${n}?`), help: t("Distance, mobility, health: so the experiences remain possible.", `Distance, mobilité, santé${n}: pour que les expériences restent possibles.`) },
      ],
    },
    {
      id: "letter",
      title: t("What I want to tell you", "Ce que je veux vous dire"),
      description: t("Chapter 4: a memory and the words kept for later.", `Chapitre 4${n}: un souvenir et les mots gardés pour plus tard.`),
      questions: [
        { id: "memory", type: "longtext", maxLength: 1200, label: t("A memory you already share", "Un souvenir que vous partagez déjà"), help: t("One or two sentences are enough.", "Une ou deux phrases suffisent.") },
        { id: "message", type: "longtext", sensitive: true, maxLength: 1200, label: t("The words you have kept for later", "Les mots que vous gardez pour plus tard"), help: t("Written gently, in your voice.", "Écrits avec délicatesse, avec votre voix.") },
      ],
    },
    {
      id: "closing",
      title: t("Our album", "Notre album"),
      description: t("The album at the end of the book, and the first page.", "L'album en fin de livre, et la première page."),
      questions: [
        photos("albumPhotos", 8, t("Photos for the album", "Des photos pour l'album"), t("Up to 8: old or recent, with a caption if you like. Private: used only for your book.", `Jusqu'à 8${n}: anciennes ou récentes, avec une légende si vous le souhaitez. Privées${n}: elles servent uniquement à votre livre.`)),
        dedication,
      ],
    },
  ],
};

const isLife = { q: "scope", op: "eq" as const, value: "life" };
const isChapter = { q: "scope", op: "eq" as const, value: "chapter" };

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
        { id: "birthYear", type: "date", label: t("Year of birth", "Année de naissance"), help: t("A year is enough: 1958.", `Une année suffit${n}: 1958.`), showIf: isLife },
        { id: "birthPlace", type: "text", maxLength: 120, label: t("Where did they grow up?", `Où a-t-il ou a-t-elle grandi${n}?`), showIf: isLife },
        { id: "period", type: "text", required: true, maxLength: 120, label: t("Which chapter?", `Quel chapitre${n}?`), help: t("For example: the Paris years, 1994–2001.", `Par exemple${n}: les années parisiennes, 1994–2001.`), showIf: isChapter },
        { id: "portrait", type: "text", maxLength: 160, label: t("Three words to describe them", "Trois mots pour le ou la décrire") },
        photos("coverPhoto", 1, t("The cover photo", "La photo de couverture"), t("A portrait, ideally upright and sharp. Private: used only for your book.", `Un portrait, de préférence vertical et net. Privée${n}: elle sert uniquement à votre livre.`)),
      ],
    },
    {
      id: "childhood",
      title: t("The first images", "Les premières images"),
      description: t("The childhood chapter.", "Le chapitre de l'enfance."),
      showIf: isLife,
      questions: [
        { id: "family", type: "longtext", maxLength: 1200, label: t("The family and the house", "La famille et la maison"), help: t("Who raised them, brothers and sisters, the house, the neighbourhood.", "Qui l'a élevé(e), les frères et sœurs, la maison, le quartier.") },
        { id: "childhoodMemory", type: "longtext", maxLength: 1200, label: t("A childhood memory", "Un souvenir d'enfance"), help: t("A smell, a game, a Sunday, a fear.", "Une odeur, un jeu, un dimanche, une peur.") },
        photos("childhoodPhotos", 4, t("Childhood photos", "Des photos d'enfance")),
      ],
    },
    {
      id: "youth",
      title: t("The age of possibilities", "L'âge des possibles"),
      description: t("The youth chapter.", "Le chapitre de la jeunesse."),
      showIf: isLife,
      questions: [
        { id: "youth", type: "longtext", maxLength: 1200, label: t("Studies, first jobs, first departures", "Les études, les premiers emplois, les premiers départs") },
        { id: "firstSteps", type: "text", maxLength: 200, label: t("A first achievement or a first escape", "Un premier exploit ou une première échappée") },
        photos("youthPhotos", 3, t("Photos from those years", "Des photos de ces années-là")),
      ],
    },
    {
      id: "setting",
      title: t("The setting", "Le décor"),
      description: t("Where and when the chapter begins.", "Où et quand commence le chapitre."),
      showIf: isChapter,
      questions: [
        { id: "before", type: "longtext", maxLength: 1200, label: t("Life just before this chapter", "La vie juste avant ce chapitre") },
        photos("settingPhotos", 3, t("Photos of the place or the era", "Des photos du lieu ou de l'époque")),
      ],
    },
    {
      id: "heart",
      title: t("The heart of the story", "Le cœur de l'histoire"),
      showIf: isChapter,
      questions: [
        { id: "heart", type: "longtext", maxLength: 2000, label: t("What happened during this period", "Ce qui s'est passé pendant cette période"), help: t("The arrivals, the trials, the joys, in any order.", "Les arrivées, les épreuves, les joies, dans le désordre.") },
        photos("heartPhotos", 3, t("Photos from this period", "Des photos de cette période")),
      ],
    },
    {
      id: "people",
      title: t("The encounters", "Les rencontres"),
      questions: [
        { id: "people", type: "text", maxLength: 300, label: t("The people who count", "Les personnes qui comptent"), help: t("First name and relationship: Bernard (husband), Lucie (best friend)…", `Prénom et lien${n}: Bernard (son mari), Lucie (sa meilleure amie)…`) },
        { id: "loveStory", type: "longtext", maxLength: 1200, label: t("An encounter that changed everything", "Une rencontre qui a tout changé") },
        photos("peoplePhotos", 4, t("Photos with the people who count", "Des photos avec les personnes qui comptent")),
      ],
    },
    {
      id: "scenes",
      title: t("The sets and the big scenes", "Les décors et les grandes scènes"),
      questions: [
        { id: "places", type: "text", required: true, maxLength: 200, label: t("Places that matter", "Les lieux qui comptent"), help: t("Cities, houses, countries.", "Des villes, des maisons, des pays.") },
        photos("placesPhotos", 4, t("Photos of these places", "Des photos de ces lieux")),
        { id: "turningPoints", type: "longtext", required: true, maxLength: 1200, label: t("Three dates that changed everything", "Trois dates qui ont tout changé"), help: t("A year and one line for each.", "Une année et une ligne pour chacune.") },
        { id: "memory", type: "longtext", sensitive: true, maxLength: 1200, label: t("A memory you could tell a hundred times", "Un souvenir que vous pourriez raconter cent fois"), help: t("Told as a memory, never presented as a verified fact.", "Raconté comme un souvenir, jamais présenté comme un fait vérifié.") },
      ],
    },
    {
      id: "work",
      title: t("Work and passions", "Le métier, les passions"),
      questions: [
        { id: "work", type: "longtext", maxLength: 1200, label: t("A trade, a craft, a career", "Un métier, un savoir-faire, une carrière") },
        { id: "passions", type: "text", maxLength: 200, label: t("Passions", "Les passions"), help: t("Gardening, football, opera, crosswords…", "Le jardin, le football, l'opéra, les mots croisés…") },
        photos("workPhotos", 3, t("Photos at work or of a passion", "Des photos au travail ou d'une passion")),
      ],
    },
    {
      id: "today",
      title: t("Today", "Aujourd'hui"),
      questions: [
        { id: "today", type: "longtext", maxLength: 1200, label: t("Life today", "La vie aujourd'hui") },
        { id: "legacy", type: "longtext", maxLength: 1200, label: t("What is passed on", "Ce qui se transmet"), help: t("A value, a recipe, a saying, a gesture.", "Une valeur, une recette, une phrase, un geste.") },
        { id: "anecdote", type: "longtext", maxLength: 800, label: t("An anecdote everyone in the family knows", "Une anecdote que toute la famille connaît") },
        photos("todayPhotos", 3, t("Recent photos", "Des photos récentes")),
        dedication,
      ],
    },
  ],
};

/** Version des définitions ci-dessus (le seed crée cette version si elle manque). */
export const STARTER_DEFINITIONS_VERSION = 2;

export const STARTER_DEFINITIONS: Record<CollectionKey, DefinitionInput> = {
  "secret-book": secretBook,
  "before-its-too-late": beforeItsTooLate,
  "movie-of-my-life": movieOfMyLife,
};
