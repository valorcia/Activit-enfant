/**
 * Démonstration UNWRITTEN — collection « Before It's Too Late » (français, carré 210 mm).
 * Texte rédigé à la main pour la démonstration du moteur éditorial ; aucune génération IA.
 * Personnalisation fictive : Jeanne (destinataire), Claire (autrice), rue des Lices, Saint-Malo.
 * Les souvenirs non documentés sont formulés comme des souvenirs (« tu racontes que… »).
 */
import type { ManuscriptInput } from "@/lib/editorial/manuscript";

export const BEFORE_TOO_LATE_DEMO: ManuscriptInput = {
  collection: "before-too-late",
  lang: "fr",
  title: "Before It's Too Late",
  subtitle: "Ce que je ne t'ai jamais dit",
  recipient: "Jeanne",
  author: "par Claire, sa fille",
  dedication: { text: "À toi, maman,\nqui m'as appris à plier les draps, à écouter la mer et à ne jamais partir fâchée.", signature: "Claire" },
  cover: { direction: "before-letter", kicker: "Chère maman," },
  edition: { number: "0002" },
  personalization: ["Jeanne", "Claire", "rue des Lices", "Saint-Malo"],
  chapters: [
    {
      title: "La cuisine de la rue des Lices",
      blocks: [
        "Il y a des pièces qui ne sont pas des pièces mais des saisons. La cuisine de la rue des Lices était de celles-là. En hiver, la buée couvrait la fenêtre et tu y dessinais du doigt un soleil pour me faire rire. Au printemps, il y avait toujours un bouquet de jonquilles dans le pot à moutarde, parce que tu disais qu'un vase, c'était pour les gens qui n'avaient pas d'imagination.",
        "Je revois la toile cirée à carreaux bleus, usée à l'endroit exact où tu posais ton coude pour lire le journal. Je revois la radio sur le frigo, toujours un peu trop basse, et toi qui chantais par-dessus, toujours un peu trop fort. Je revois tes mains, surtout. Des mains qui ne restaient jamais immobiles : elles épluchaient, pétrissaient, recousaient un bouton, corrigeaient mes devoirs en marge, d'une écriture penchée que je reconnaîtrais entre mille.",
        "Tu racontes souvent que j'ai fait mes premiers pas dans cette cuisine, en me tenant au pied de la table, le jour où l'on a fêté les quarante ans de papa. Je ne m'en souviens pas, évidemment. Mais je crois que je me souviens du bruit : les rires, les verres, et toi qui criais « regardez-la ! » comme si j'avais traversé l'Atlantique.",
        { type: "break" },
        "Ce que je ne t'ai jamais dit, c'est que j'ai longtemps cru que le bonheur avait une odeur, et que c'était celle du gâteau au yaourt du dimanche. Quand je suis partie à Paris pour mes études, la première chose que j'ai faite dans ma chambre de bonne, avant même de défaire ma valise, c'est d'en préparer un. Il était raté, trop cuit, affaissé au milieu. Je l'ai mangé entier, assise par terre, en pleurant un peu. C'était le meilleur gâteau de ma vie.",
        "Je n'ai jamais osé te le raconter. J'avais peur que tu t'inquiètes, ou pire, que tu viennes me chercher. Aujourd'hui, je voudrais simplement que tu saches que tu étais là, dans cette chambre minuscule, avec moi. Tu y étais à chaque fois que j'ai eu peur, dans l'odeur du beurre et du sucre, dans cette façon que j'ai, encore maintenant, de chanter trop fort quand la radio est trop basse.",
        { type: "memory", title: "La cuisine", prompt: "Colle ici une photo de la cuisine de la rue des Lices, ou d'un plat que tu préparais. Puis note ce qu'on y entendait, ce qu'on y sentait.", kind: "both", fields: ["Date", "Lieu"] },
        "On ne sait pas, quand on est enfant, que les cuisines disparaissent. On croit qu'elles nous attendront toujours, avec leur toile cirée et leur pot à moutarde. Puis un jour on rend les clés, on vide les placards, et l'on découvre que ce qu'on voulait garder ne tient dans aucun carton. Alors j'ai décidé de l'écrire. Ce livre est mon carton.",
      ],
    },
    {
      title: "Ce que tu m'as appris sans le dire",
      blocks: [
        "Tu n'as jamais été une mère qui fait des discours. Tu détestais les leçons de morale autant que les fausses excuses. Tu apprenais les choses aux autres comme on apprend à nager à un enfant : en restant tout près, sans rien dire, et en lâchant la main juste au bon moment.",
        "C'est toi qui m'as appris à ne jamais partir fâchée. Tu ne l'as jamais formulé ainsi. Mais chaque soir, même après nos pires disputes, même ce soir de mes seize ans où j'avais claqué la porte si fort que le cadre du couloir était tombé, tu venais frapper doucement à ma chambre. Tu ne disais rien. Tu posais un verre de lait sur la table de nuit et tu repartais. C'était ta manière de dire que la nuit ne compterait pas.",
        "C'est toi aussi qui m'as appris que le courage n'était pas l'absence de peur. Je t'ai vue, l'année de la maladie de grand-mère, faire chaque semaine l'aller-retour jusqu'à Rennes, dans la vieille voiture qui calait aux feux rouges. Tu chantais pour te donner du cœur. Tu prétendais que c'était pour moi.",
        { type: "quote", text: "On ne choisit pas ce qui nous arrive. On choisit seulement la manière de le porter.", source: "Jeanne, un dimanche de novembre" },
        "Je ne sais pas si tu te souviens de m'avoir dit cette phrase. Moi, je l'ai gardée. Je l'ai recopiée dans des carnets, sur des post-it, au dos d'une photo. Je l'ai répétée à mes propres enfants, sans toujours dire d'où elle venait. Je voudrais te la rendre ici, avec ton nom à côté.",
        { type: "activity", title: "Une lettre à écrire", prompt: "Il y a sûrement quelqu'un à qui tu n'as jamais dit merci comme il le méritait. Écris-lui ici quelques lignes, sans te relire. Tu décideras plus tard de les envoyer ou non.", kind: "letter" },
      ],
    },
    {
      title: "Les étés à Saint-Malo",
      epigraph: { text: "La mer, c'est ce qui reste quand on a tout oublié.", source: "Proverbe de la famille" },
      blocks: [
        "Chaque mois d'août, nous partions pour Saint-Malo dans la voiture surchargée, le parasol attaché sur le toit avec une corde à linge. Le voyage durait trois heures et tu en faisais une expédition. Il y avait des sandwiches au pâté enveloppés dans du papier d'aluminium, une bouteille d'eau qui devenait tiède dès Vitré, et ce jeu que tu avais inventé : le premier qui voyait la mer avait le droit de choisir le dessert du soir.",
        "Je gagnais presque toujours. Je sais aujourd'hui que tu faisais exprès de regarder de l'autre côté.",
        "Tu racontes que la première fois que je suis entrée dans l'eau, j'avais trois ans et que j'ai crié de saisissement, puis de joie, puis de colère quand tu m'as sortie pour me sécher. Je n'ai pas ce souvenir-là. Mais j'ai celui de ta main dans la mienne, des années plus tard, quand nous marchions sur les remparts à la tombée du jour et que tu me montrais les îles une à une, en les appelant par leur nom comme on salue des voisins.",
        { type: "illustration", mode: "full", caption: "Les remparts de Saint-Malo, un soir d'août" },
        "Le Grand Bé, le Petit Bé, l'île Harbour, la Conchée. Tu les connaissais toutes. Tu disais qu'il fallait apprendre les noms des choses qu'on aime, parce que c'est la seule façon de les garder quand on n'est plus là pour les voir.",
        { type: "break" },
        "Le dernier été que nous avons passé là-bas toutes les deux, j'avais vingt-trois ans et je venais de rencontrer Thomas. J'étais impatiente, distraite, je regardais mon téléphone toutes les cinq minutes. Tu ne m'as fait aucun reproche. Le dernier soir, sur les remparts, tu m'as simplement prise par le bras et tu m'as dit : « Regarde bien. On ne revient jamais tout à fait au même endroit. »",
        "Tu avais raison. Je suis revenue souvent, avec Thomas, puis avec les enfants. La mer était la même, les îles aussi. Mais il manquait quelqu'un pour les appeler par leur nom.",
        { type: "citation", text: "Il faut apprendre les noms des choses qu'on aime. C'est la seule façon de les garder.", source: "Jeanne, sur les remparts" },
      ],
    },
    {
      title: "Les questions que je n'ai jamais posées",
      blocks: [
        "Il y a des questions qu'on remet toujours à plus tard, parce qu'on croit avoir le temps, ou parce qu'on a peur des réponses. J'en ai une liste entière. Je l'ai commencée il y a des années sur une page de carnet, et elle n'a jamais cessé de s'allonger.",
        "Je ne sais pas comment tu as rencontré papa, vraiment. Je connais la version officielle, celle du bal du 14 Juillet et de la limonade renversée. Mais je soupçonne qu'il y a une autre histoire derrière, une histoire que vous gardiez pour vous, et que je voudrais entendre de ta voix.",
        "Je ne sais pas non plus ce que tu voulais faire, toi, avant que la vie décide pour toi. Tu as parlé une fois, un soir, d'une école de dessin à Rennes. Puis tu as changé de sujet. Je n'ai pas insisté. Je le regrette.",
        "Alors voilà : ce livre est aussi une invitation. Les pages qui suivent sont à toi. Tu n'es pas obligée d'y répondre. Mais si un jour tu en as envie, je serai là, avec un gâteau au yaourt et la radio un peu trop basse.",
        { type: "activity", title: "Les questions de Claire", prompt: "Réponds à celles que tu veux, dans l'ordre que tu veux. Il n'y a pas de mauvaise réponse, seulement des souvenirs.", kind: "checklist", items: ["Comment as-tu vraiment rencontré papa ?", "Qu'aurais-tu aimé faire, si tu avais pu choisir ?", "Quel est le plus beau jour dont tu te souviennes ?"] },
      ],
    },
  ],
  conclusion: {
    title: "Avant qu'il ne soit trop tard",
    blocks: [
      "J'ai écrit ce livre parce que j'ai compris un matin que je n'avais jamais dit à ma mère ce qu'elle représentait pour moi. Pas par pudeur, pas par manque d'amour : seulement parce que je croyais qu'il serait toujours temps.",
      "Il est temps. Merci, maman, pour la cuisine de la rue des Lices, pour les noms des îles, pour les verres de lait posés sans un mot. Tout ce que je sais de la douceur, je l'ai appris de toi.",
    ],
    signature: "Ta fille, Claire",
  },
  backCover: {
    blurb: "Une cuisine rue des Lices, des étés à Saint-Malo, des phrases qu'on garde toute une vie sans savoir d'où elles viennent.\nClaire a écrit pour sa mère, Jeanne, tout ce qu'elle n'avait jamais osé lui dire. Et lui a laissé des pages blanches pour lui répondre.",
    quote: "On ne revient jamais tout à fait au même endroit.",
  },
};
