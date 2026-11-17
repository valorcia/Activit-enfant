/**
 * Démonstration UNWRITTEN — collection « The Movie of My Life » (français, portrait 3:4).
 * Texte rédigé à la main pour la démonstration du moteur éditorial ; aucune génération IA.
 * Personnalisation fictive : Hélène Marchand, née en 1951 à Lyon (Croix-Rousse), Bernard, l'atelier.
 * Les épisodes non documentés sont rédigés comme des souvenirs rapportés, jamais comme des faits.
 */
import type { ManuscriptInput } from "@/lib/editorial/manuscript";

export const MOVIE_OF_MY_LIFE_DEMO: ManuscriptInput = {
  collection: "movie-of-my-life",
  lang: "fr",
  title: "Une vie en plan large",
  subtitle: "Le film d'Hélène Marchand",
  recipient: "Hélène",
  author: "raconté par ses enfants et petits-enfants",
  dedication: { text: "Pour Hélène, qui a toujours préféré les films où l'on rit à la fin,\npour ses soixante-quinze ans.", signature: "Sophie, Lucas, Inès et Paul" },
  epigraph: { text: "Une vie, ce n'est pas ce qui nous arrive. C'est ce dont on se souvient, et la manière dont on le raconte.", source: "D'après Gabriel García Márquez" },
  cover: {
    direction: "movie-poster",
    marks: ["Hélène Marchand dans son propre rôle", "avec Bernard · Sophie · Lucas · et la Croix-Rousse", "un film écrit par sa famille · Lyon 1951 — 2026"],
  },
  edition: { number: "0003", note: "Les souvenirs rapportés dans ce livre sont racontés tels que la famille s'en souvient ; ils n'ont pas tous été vérifiés." },
  personalization: ["Hélène Marchand", "Croix-Rousse", "Bernard", "1951"],
  chapters: [
    {
      title: "Générique de début",
      label: "Prologue",
      blocks: [
        "Tous les films commencent dans le noir. Celui-ci aussi. Une salle qui se tait, un rideau qui s'ouvre, et puis, sur l'écran encore vide, un nom qui s'écrit lentement, en lettres blanches : Hélène Marchand.",
        "Nous avons longtemps cherché comment raconter ta vie. Une biographie aurait été trop sérieuse, un album trop sage. Puis Lucas a rappelé que tu disais toujours, en sortant du cinéma de la Croix-Rousse, qu'un bon film, c'est « une vie en plus ». Alors nous avons pensé : et si c'était l'inverse ? Et si une vie, c'était un film ?",
        "Voici donc le tien, en quatre actes, avec ses plans larges et ses gros plans, ses scènes coupées au montage et ses répliques que toute la famille connaît par cœur. Nous l'avons écrit à plusieurs mains, à partir de tes récits, de nos souvenirs et de quelques documents retrouvés dans la boîte à chaussures du placard. Quand nous n'étions pas sûrs, nous l'avons dit.",
      ],
    },
    {
      title: "Les pentes de la Croix-Rousse",
      label: "Acte I",
      epigraph: { text: "Lyon, 1951. Extérieur jour.", source: "Indication de tournage" },
      blocks: [
        "Le film s'ouvre sur un escalier. Pas n'importe lequel : la montée de la Grande-Côte, ses marches usées, ses pavés luisants de pluie, et tout en haut, une fenêtre du quatrième étage où une femme étend du linge au-dessus du vide. C'est ta mère. Tu as quatre ans, tu es assise sur la dernière marche avec un morceau de pain, et tu regardes la ville en bas comme on regarde la mer.",
        "Tu racontes souvent que tu es née « entre deux métiers à tisser ». Ton père travaillait encore la soie dans un atelier de la rue d'Austerlitz, et le bruit des machines, ce tac-tac régulier qui traversait les murs, a été la première musique de ta vie. Tu dis que tu pourrais encore le reconnaître les yeux fermés. Nous te croyons.",
        "Les traboules étaient ton terrain de jeu. Ces passages secrets qui traversent les immeubles d'une rue à l'autre, tu les connaissais tous, et tu les empruntais pour semer les garçons du quartier ou pour arriver en avance à l'école sans passer par la grand-rue. Tu en parles encore comme d'un royaume. Tu nous as appris, à nous aussi, à pousser les lourdes portes et à suivre la lumière au bout des couloirs.",
        { type: "memory", title: "La montée de la Grande-Côte", prompt: "Une photo de la Croix-Rousse, d'hier ou d'aujourd'hui, et ce que ce quartier représente pour toi.", kind: "photo" },
        "Il y a, dans la boîte à chaussures, une photo de classe datée de 1959. Tu es au deuxième rang, la troisième en partant de la gauche, avec une frange coupée trop court et un regard qui défie l'objectif. La maîtresse a écrit au dos, au crayon : « Hélène, bavarde mais vive ». C'est le seul document que nous ayons de cette époque. Il dit déjà presque tout.",
        { type: "break" },
        "À seize ans, tu as quitté l'école pour entrer comme apprentie chez une couturière de la place Sathonay. Tu dis que tu as appris là-bas les deux choses les plus utiles de ta vie : coudre droit, et te taire quand il le fallait. Nous ne t'avons jamais vue faire la seconde. La première, en revanche, tu la fais encore mieux que personne.",
      ],
    },
    {
      title: "Bernard, le 7 juin 1974",
      label: "Acte II",
      blocks: [
        "Toute grande histoire a besoin d'une rencontre, et celle-ci a lieu sous la pluie. Il est dix-huit heures, place de la Croix-Rousse, un vendredi de juin. Tu sors de l'atelier sans parapluie. Un jeune homme en veste de velours te propose le sien. Tu refuses, évidemment. Il insiste. Tu refuses encore. Il finit par te le laisser et repart sous l'averse, trempé jusqu'aux os, sans même te demander ton nom.",
        "C'est du moins la version que tu racontes. Papi Bernard, lui, a toujours juré que c'était toi qui avais demandé à partager son parapluie, et qu'il avait fait semblant d'hésiter. Nous ne trancherons pas. Nous avons appris depuis longtemps que, dans cette famille, les deux versions d'une histoire sont vraies en même temps.",
        { type: "illustration", mode: "figure", caption: "Place de la Croix-Rousse, un soir de pluie, juin 1974" },
        "Ce qui est certain, parce que nous avons retrouvé le ticket, c'est que vous êtes allés au cinéma la semaine suivante. Le Chanteclerc, séance de vingt et une heures, deux places au balcon. Le film, tu ne t'en souviens plus. Tu dis que tu n'as pas regardé l'écran.",
        "Vous vous êtes mariés à la mairie du quatrième arrondissement le 12 avril 1975. Il pleuvait encore. Sur la seule photo du jour, tu ris aux éclats sous un parapluie trop petit, et Bernard, à côté de toi, regarde l'objectif avec l'air de quelqu'un qui n'en revient toujours pas.",
        { type: "citation", text: "Dans cette famille, les deux versions d'une histoire sont vraies en même temps.", source: "Règle numéro un de la famille Marchand" },
        "Il nous a quittés en 2019. Tu ne parles pas souvent de lui au passé. Tu dis « Bernard aime le café fort », « Bernard trouve que ce film est trop long ». Nous avons cessé de te corriger. Au fond, tu as raison : dans un film, les personnages ne meurent jamais tout à fait. Il suffit de rembobiner.",
      ],
    },
    {
      title: "Les années atelier",
      label: "Acte III",
      blocks: [
        "En 1981, tu as ouvert ton propre atelier de retouches, rue d'Ivry, dans une ancienne boutique de bonneterie dont tu avais gardé l'enseigne peinte. Tout le quartier y est passé. Des robes de mariée raccourcies la veille de la cérémonie, des costumes élargis après les fêtes, des doudous recousus en urgence un dimanche matin parce qu'un enfant ne pouvait pas dormir sans eux.",
        "Tu racontes que tu n'as jamais affiché de prix. Tu demandais aux clients ce qu'ils pensaient que valait ton travail, et tu dis qu'on ne t'a presque jamais déçue. Sophie, qui tenait ta comptabilité le samedi, affirme que c'est un miracle que l'atelier ait tenu vingt-cinq ans. Elle ajoute aussitôt qu'elle n'aurait pas voulu que tu fasses autrement.",
        { type: "illustration", mode: "full", caption: "L'atelier de la rue d'Ivry, vers 1985" },
        "Nous avons grandi entre les bobines de fil et les mannequins sans tête. Nous faisions nos devoirs sur la grande table de coupe, à côté des patrons en papier de soie, pendant que la radio diffusait des chansons de Barbara. Lucas a appris à lire sur les étiquettes des tissus. Sophie a appris à compter avec la caisse enregistreuse. Moi, j'ai surtout appris à rester immobile pendant les essayages.",
        "Le jour de la fermeture, en 2006, tu as tenu à ce que tout le quartier vienne boire un verre. Il y avait des clients de vingt-cinq ans, des enfants devenus parents, une ancienne mariée qui portait encore la robe que tu avais retouchée. Tu as fait un petit discours, toi qui détestes les discours. Tu as dit : « Merci de m'avoir confié vos vêtements. C'était une manière de me confier un peu de vos vies. »",
      ],
    },
    {
      title: "Ce que le film ne montre pas",
      label: "Acte IV",
      blocks: [
        "Il y a, dans chaque film, des scènes que le spectateur ne voit pas. Celles qui se passent entre deux plans, pendant qu'on change de décor. Les nuits blanches, les doutes, les lettres qu'on n'a pas envoyées. Ta vie en a eu, comme toutes les vies, et nous n'avons pas voulu les inventer. Elles t'appartiennent.",
        "Mais nous savons quelques choses. Nous savons que tu as recommencé à dessiner, l'an dernier, après cinquante ans d'interruption. Nous savons que tu gardes, dans le tiroir de ta table de nuit, le parapluie miniature en argent que Bernard t'avait offert pour vos noces d'argent. Nous savons que tu appelles chacun de tes petits-enfants le jour de son anniversaire, à l'heure exacte de sa naissance, et que tu ne t'es jamais trompée.",
        "Ce livre s'arrête ici, mais le film continue. Il te reste des scènes à tourner, et nous comptons bien y figurer.",
        { type: "activity", title: "Votre réplique culte", prompt: "Chaque membre de la famille écrit ici la phrase d'Hélène qu'il connaît par cœur, et le moment où il l'a entendue pour la première fois.", kind: "lines" },
      ],
    },
  ],
  conclusion: {
    title: "Générique de fin",
    blocks: [
      "Dans le rôle d'Hélène, Hélène Marchand. Dans le rôle de Bernard, Bernard Marchand, pour toujours. Dans les seconds rôles, par ordre d'apparition : Sophie, Lucas, Inès et Paul. Avec la participation de la Croix-Rousse, de la place Sathonay et de la rue d'Ivry.",
      "Ce film a été écrit à partir de tes récits, de nos souvenirs et d'une boîte à chaussures. Toute ressemblance avec une femme réelle, drôle, têtue et merveilleuse est absolument volontaire.",
    ],
    signature: "Joyeux anniversaire, maman",
  },
  backCover: {
    blurb: "Lyon, 1951 : une petite fille assise en haut de la montée de la Grande-Côte regarde la ville comme on regarde la mer.\nSoixante-quinze ans plus tard, ses enfants racontent sa vie comme un film, en quatre actes, avec ses plans larges, ses gros plans et ses répliques que toute la famille connaît par cœur.",
    quote: "Un bon film, c'est une vie en plus.",
  },
};
