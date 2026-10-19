import type { ActivityConcept, ActivityContent, VisualReferenceSheet, CoverData } from "../schemas/activity";

/**
 * Projet de démonstration : « Les Petits Inventeurs — 10 inventions extraordinaires »
 * Public : 6 à 9 ans. Les 10 concepts et la fiche pilote complète sont rédigés à la main
 * pour servir de référence de qualité et permettre de tester le parcours sans clé API.
 */

export const DEMO_BOOK = {
  title: "Les Petits Inventeurs",
  subtitle: "10 inventions extraordinaires",
  collection: "Inventor Studio",
  bookType: "inventions",
  ageRange: "6-9",
  artStyle: "aquarelle",
  pageFormat: "A4_PORTRAIT",
  brief:
    "Crée un livre de 10 inventions extraordinaires pour enfants de 6 à 9 ans, avec des illustrations détaillées, une mise en page professionnelle et un PDF A4 imprimable.",
  introduction:
    "Bienvenue dans l'atelier des petits inventeurs ! Dans ce livre, tu vas construire dix machines étonnantes avec des objets de tous les jours. À chaque fois, tu découvriras le secret scientifique qui les fait fonctionner. Prépare tes ciseaux, ta colle et ta curiosité : l'aventure commence !",
};

export const DEMO_CONCEPTS: ActivityConcept[] = [
  {
    title: "Construis ta voiture propulsée par un ballon",
    summary: "Une petite voiture en carton qui avance toute seule grâce à l'air qui s'échappe d'un ballon de baudruche.",
    category: "inventions",
    finalObject: "Voiture en carton à quatre roues de bouchons, avec un ballon fixé sur une paille à l'arrière",
    mainConcept: "Action et réaction : l'air qui sort du ballon pousse la voiture dans l'autre sens",
    difficulty: 2,
    durationMinutes: 45,
    keyMaterials: ["carton", "4 bouchons", "2 brochettes en bois", "pailles", "ballon de baudruche", "ruban adhésif"],
  },
  {
    title: "Le périscope pour voir par-dessus les murs",
    summary: "Un tube en carton avec deux miroirs pour regarder au-dessus d'un obstacle sans être vu.",
    category: "inventions",
    finalObject: "Tube rectangulaire en carton avec deux petits miroirs inclinés à 45° aux extrémités",
    mainConcept: "La réflexion de la lumière sur un miroir",
    difficulty: 3,
    durationMinutes: 50,
    keyMaterials: ["carton", "2 petits miroirs", "ruban adhésif", "règle", "ciseaux"],
  },
  {
    title: "La catapulte à cuillère",
    summary: "Une catapulte en bâtonnets et élastiques pour lancer des boulettes de papier.",
    category: "inventions",
    finalObject: "Catapulte faite de bâtonnets de glace empilés, d'élastiques et d'une cuillère en plastique",
    mainConcept: "Le levier et l'énergie élastique",
    difficulty: 2,
    durationMinutes: 30,
    keyMaterials: ["bâtonnets de glace", "élastiques", "cuillère en plastique", "boulettes de papier"],
  },
  {
    title: "Le téléphone à gobelets",
    summary: "Deux gobelets reliés par une ficelle tendue pour se parler à distance.",
    category: "inventions",
    finalObject: "Deux gobelets en carton reliés par une ficelle de 5 mètres",
    mainConcept: "Le son voyage sous forme de vibrations",
    difficulty: 1,
    durationMinutes: 20,
    keyMaterials: ["2 gobelets en carton", "ficelle", "2 trombones", "pointe ou cure-dent"],
  },
  {
    title: "Le moulin à eau de bouteille",
    summary: "Une roue à aubes fabriquée avec une bouteille qui tourne sous un filet d'eau.",
    category: "inventions",
    finalObject: "Roue à aubes en bouchons de liège et cuillères en plastique montée sur une brochette",
    mainConcept: "L'énergie de l'eau en mouvement fait tourner une roue",
    difficulty: 3,
    durationMinutes: 40,
    keyMaterials: ["bouteille en plastique", "cuillères en plastique", "bouchon de liège", "brochette", "ciseaux"],
  },
  {
    title: "La lampe de poche de secours",
    summary: "Une lampe simple avec une pile, une ampoule LED et un interrupteur en trombone.",
    category: "inventions",
    finalObject: "Rouleau de carton contenant une pile plate, une LED et un interrupteur en trombone",
    mainConcept: "Le circuit électrique fermé et ouvert",
    difficulty: 3,
    durationMinutes: 45,
    keyMaterials: ["pile plate 4,5 V", "LED", "trombone", "ruban adhésif", "rouleau de carton", "attaches parisiennes"],
  },
  {
    title: "Le bateau à savon",
    summary: "Un petit bateau en carton qui avance sur l'eau grâce à une goutte de liquide vaisselle.",
    category: "inventions",
    finalObject: "Petit bateau en carton plat avec une encoche à l'arrière",
    mainConcept: "La tension de surface de l'eau",
    difficulty: 1,
    durationMinutes: 20,
    keyMaterials: ["carton fin", "liquide vaisselle", "bassine d'eau", "ciseaux"],
  },
  {
    title: "Le bras robot en carton",
    summary: "Une pince articulée en carton et attaches parisiennes qui attrape des objets légers.",
    category: "inventions",
    finalObject: "Bras articulé en carton à deux mâchoires commandé par deux poignées",
    mainConcept: "Les leviers et les articulations",
    difficulty: 3,
    durationMinutes: 50,
    keyMaterials: ["carton épais", "attaches parisiennes", "ciseaux", "règle", "crayon"],
  },
  {
    title: "La fusée à air comprimé",
    summary: "Une fusée en papier lancée par le souffle d'une bouteille écrasée.",
    category: "inventions",
    finalObject: "Fusée en papier enroulée autour d'une paille, bouteille souple comme lanceur",
    mainConcept: "La pression de l'air",
    difficulty: 2,
    durationMinutes: 30,
    keyMaterials: ["bouteille en plastique souple", "paille", "papier", "ruban adhésif", "ciseaux"],
  },
  {
    title: "Le cadran solaire de poche",
    summary: "Un cadran en carton pour lire l'heure grâce à l'ombre du soleil.",
    category: "inventions",
    finalObject: "Disque de carton gradué avec une tige verticale au centre",
    mainConcept: "Le mouvement apparent du soleil et les ombres",
    difficulty: 2,
    durationMinutes: 40,
    keyMaterials: ["carton", "crayon", "pâte à modeler", "brochette", "montre"],
  },
];

export const PILOT_ACTIVITY: ActivityContent = {
  title: "Construis ta voiture propulsée par un ballon",
  subtitle: "Une voiture qui roule sans moteur ni pile !",
  description:
    "Avec un peu de carton, quatre bouchons et un ballon de baudruche, tu vas fabriquer une voiture qui avance toute seule. Quand tu lâches le ballon gonflé, l'air s'échappe par la paille et pousse la voiture vers l'avant. C'est le même principe que celui qui propulse les vraies fusées !",
  pedagogicalGoal:
    "Comprendre le principe d'action-réaction : lorsqu'un objet pousse de l'air dans une direction, il est poussé dans la direction opposée. Développer la motricité fine (découpage, assemblage) et la démarche d'expérimentation (tester, observer, améliorer).",
  ageRange: "6-9",
  durationMinutes: 45,
  difficulty: 2,
  category: "inventions",
  tags: ["physique", "air", "mouvement", "recyclage", "fusée"],
  materials: [
    { name: "Carton rigide (boîte de céréales ou carton ondulé)", quantity: "1 morceau de 15 × 8 cm", optional: false, note: "" },
    { name: "Bouchons de bouteille en plastique", quantity: "4", optional: false, note: "Tous de la même taille pour que la voiture roule droit" },
    { name: "Brochettes en bois", quantity: "2", optional: false, note: "Elles serviront d'essieux" },
    { name: "Pailles", quantity: "3", optional: false, note: "2 pour les essieux, 1 pour le ballon" },
    { name: "Ballon de baudruche", quantity: "1", optional: false, note: "Prévoir un ballon de rechange" },
    { name: "Ruban adhésif", quantity: "1 rouleau", optional: false, note: "" },
    { name: "Ciseaux", quantity: "1 paire", optional: false, note: "À bouts ronds" },
    { name: "Pâte à fixer ou clou fin", quantity: "", optional: false, note: "Pour percer les bouchons (un adulte s'en charge)" },
    { name: "Feutres", quantity: "", optional: true, note: "Pour décorer la carrosserie" },
  ],
  steps: [
    {
      title: "Découpe la carrosserie",
      instruction:
        "Dessine un rectangle de 15 cm de long et 8 cm de large sur le carton, puis découpe-le soigneusement avec les ciseaux. Ce rectangle sera la carrosserie de ta voiture. Si tu veux, dessine des fenêtres et des phares avec les feutres.",
      tip: "Arrondis les coins pour une voiture plus jolie et plus solide.",
      adultHelp: false,
      illustrationBrief:
        "Un enfant découpe un rectangle de carton beige de 15 x 8 cm avec des ciseaux à bouts ronds, posé sur une table en bois. Le rectangle a des coins arrondis et des fenêtres dessinées au feutre bleu.",
    },
    {
      title: "Prépare les essieux",
      instruction:
        "Coupe deux morceaux de paille un peu plus courts que la largeur du carton (environ 7 cm). Colle-les avec du ruban adhésif sous la carrosserie, bien parallèles : un près de l'avant, l'autre près de l'arrière. Les brochettes passeront dedans et pourront tourner librement.",
      tip: "Vérifie que les deux pailles sont bien droites, sinon la voiture tournera en rond.",
      adultHelp: false,
      illustrationBrief:
        "Vue de dessous de la carrosserie en carton beige retournée. Deux pailles blanches sont fixées en travers avec des bandes de ruban adhésif transparent, parfaitement parallèles, une à l'avant et une à l'arrière.",
    },
    {
      title: "Perce et fixe les roues",
      instruction:
        "Demande à un adulte de percer un petit trou au centre de chaque bouchon. Enfile une brochette dans la première paille, puis enfonce un bouchon à chaque bout. Fais la même chose avec la deuxième brochette. Coupe ce qui dépasse des brochettes et protège les bouts pointus avec un peu de ruban adhésif.",
      tip: "Les bouchons doivent être bien enfoncés et bien droits pour rouler sans frotter.",
      adultHelp: true,
      illustrationBrief:
        "Gros plan : une main d'adulte perce le centre d'un bouchon de bouteille rouge avec un clou fin. À côté, la carrosserie en carton beige avec une brochette en bois passée dans une paille et deux bouchons rouges enfilés aux extrémités, formant un essieu.",
    },
    {
      title: "Installe le moteur à ballon",
      instruction:
        "Glisse l'embout du ballon autour d'une extrémité de la troisième paille et fixe-le solidement avec du ruban adhésif, sans écraser la paille. Pose ensuite la paille sur le dessus de la carrosserie, le ballon vers l'arrière et le bout libre de la paille qui dépasse derrière la voiture. Fixe la paille avec du ruban adhésif.",
      tip: "Le bout de la paille doit dépasser de 2 ou 3 cm derrière la voiture.",
      adultHelp: false,
      illustrationBrief:
        "La voiture en carton beige vue de trois quarts, posée sur ses quatre roues en bouchons rouges. Sur le dessus, une paille blanche est fixée par du ruban adhésif, avec un ballon de baudruche jaune dégonflé attaché à l'extrémité arrière de la paille.",
    },
    {
      title: "Gonfle et lance !",
      instruction:
        "Souffle dans la paille pour gonfler le ballon. Bouche le bout de la paille avec ton doigt, pose la voiture sur une surface lisse (carrelage ou parquet), puis retire ton doigt. Regarde ta voiture filer !",
      tip: "Mesure la distance parcourue avec un mètre et note ton record.",
      adultHelp: false,
      illustrationBrief:
        "La voiture en carton beige, roues en bouchons rouges, file vers la gauche sur un sol carrelé clair. Le ballon jaune gonflé est à l'arrière et se dégonfle avec des petits traits de mouvement, un enfant souriant la regarde partir.",
    },
  ],
  finalIllustrationBrief:
    "Une petite voiture artisanale faite d'un rectangle de carton beige aux coins arrondis, avec des fenêtres dessinées au feutre bleu, quatre roues faites de bouchons de bouteille rouges sur des brochettes en bois, une paille blanche fixée sur le toit et un gros ballon de baudruche jaune gonflé à l'arrière. La voiture est posée sur un sol carrelé clair, prête à partir.",
  explanation: {
    title: "Pourquoi la voiture avance-t-elle ?",
    body:
      "Quand tu gonfles le ballon, tu y enfermes de l'air sous pression. Dès que tu libères la paille, l'air se précipite vers l'arrière pour sortir. Or, chaque fois qu'une chose pousse dans une direction, elle est poussée dans la direction opposée : c'est le principe d'action-réaction, découvert par le savant Isaac Newton. L'air est poussé vers l'arrière, donc la voiture est poussée vers l'avant. Les vraies fusées fonctionnent exactement de la même façon : elles rejettent des gaz brûlants vers le bas pour s'élever vers le ciel. Plus le ballon est gros et plus la voiture est légère, plus elle ira loin !",
    keyWords: ["action-réaction", "pression", "propulsion", "Isaac Newton", "fusée"],
  },
  challenge: {
    title: "Le grand prix des ballons",
    body:
      "Organise une course avec tes amis ! Essaie ensuite d'améliorer ta voiture : que se passe-t-il si tu utilises un ballon plus gros ? Si tu ajoutes une deuxième paille et un deuxième ballon ? Si tu allèges la carrosserie ? Note tes résultats dans un tableau et trouve la combinaison championne.",
  },
  safety: {
    adultSupervision: "recommended",
    warnings: [
      "Le perçage des bouchons doit être fait par un adulte.",
      "Les brochettes ont des bouts pointus : coupe-les et protège-les avec du ruban adhésif.",
      "Un ballon non gonflé ou éclaté peut présenter un risque d'étouffement pour les plus jeunes : ne pas laisser à la portée des enfants de moins de 3 ans.",
    ],
    hazards: ["sharp", "small_parts"],
  },
  funFact: "La fusée Ariane 6 rejette chaque seconde plusieurs tonnes de gaz pour décoller, exactement comme l'air de ton ballon, mais en beaucoup plus puissant !",
};

export const PILOT_VISUAL_REFERENCE: VisualReferenceSheet = {
  finalObject:
    "Petite voiture artisanale en carton, propulsée par un ballon de baudruche fixé sur une paille au-dessus de la carrosserie",
  shape: "Carrosserie rectangulaire plate (15 × 8 cm) aux coins arrondis, quatre roues rondes de même taille, paille droite sur le toit dépassant à l'arrière",
  colors: ["carton beige/kraft", "roues rouges (bouchons)", "ballon jaune vif", "paille blanche", "fenêtres dessinées en bleu", "ruban adhésif transparent"],
  materials: ["carton", "bouchons de bouteille en plastique", "brochettes en bois", "pailles en plastique blanches", "ballon de baudruche en latex", "ruban adhésif"],
  dimensions: "Environ 15 cm de long, 8 cm de large, roues de 3 cm de diamètre, ballon gonflé d'environ 15 cm",
  mainParts: [
    { name: "Carrosserie", appearance: "Rectangle de carton beige aux coins arrondis, fenêtres et phares dessinés au feutre bleu" },
    { name: "Roues", appearance: "Quatre bouchons de bouteille rouges, identiques, montés sur des brochettes en bois" },
    { name: "Essieux", appearance: "Deux pailles blanches collées sous la carrosserie, brochettes en bois à l'intérieur" },
    { name: "Moteur à ballon", appearance: "Paille blanche fixée sur le toit par du ruban adhésif, ballon jaune attaché au bout arrière" },
  ],
  characters: "Un enfant de 7 ans, cheveux bruns courts, t-shirt vert, toujours le même d'une étape à l'autre",
  setting: "Table en bois clair dans une pièce lumineuse ; pour le lancement, sol carrelé blanc cassé",
  stepAppearances: [
    { stepIndex: 0, appearance: "Seulement le rectangle de carton beige, coins arrondis, fenêtres bleues en cours de dessin" },
    { stepIndex: 1, appearance: "Carrosserie retournée, deux pailles blanches parallèles fixées dessous" },
    { stepIndex: 2, appearance: "Carrosserie à l'endroit avec les quatre roues rouges montées, pas encore de ballon" },
    { stepIndex: 3, appearance: "Voiture complète avec paille sur le toit et ballon jaune dégonflé" },
    { stepIndex: 4, appearance: "Voiture complète, ballon jaune gonflé, en mouvement sur le carrelage" },
  ],
  styleNotes: "Vue de trois quarts privilégiée, objet bien centré, fond simple, pas de texte dans l'image",
  negativePrompt: "texte, lettres, logos, mains déformées, voiture réaliste, moteur, pièces supplémentaires",
};

export const DEMO_COVER: CoverData = {
  title: "Les Petits Inventeurs",
  subtitle: "10 inventions extraordinaires",
  collection: "Inventor Studio",
  ageLabel: "6 à 9 ans",
  tagline: "Construis, teste, comprends !",
  backText:
    "Une voiture propulsée par un ballon, un périscope pour voir par-dessus les murs, une lampe de poche de secours... Dans ce livre, les petits inventeurs fabriquent dix machines étonnantes avec des objets de tous les jours, et découvrent le secret scientifique qui se cache derrière chacune d'elles.",
  backBullets: ["10 inventions à construire soi-même", "Des étapes illustrées pas à pas", "Le secret scientifique expliqué simplement", "Des défis pour aller plus loin"],
  illustrationBrief:
    "Un enfant et une enfant souriants dans un atelier lumineux, entourés d'inventions en carton : une voiture à ballon jaune, un périscope, une catapulte à cuillère, une fusée en papier. Ambiance joyeuse, couleurs chaudes.",
  variant: 0,
};
