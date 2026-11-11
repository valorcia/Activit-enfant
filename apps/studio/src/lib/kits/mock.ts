/**
 * Contenus de démonstration (fournisseur « mock ») pour les kits : plausibles, structurés,
 * explicitement marqués comme générés hors ligne. Ils permettent de tester tout le parcours
 * kit → illustrations → pages → PDF sans clé API.
 */
import type { Coloring, Guide, KitPlan, PranksKit, Recipes, Science, TreasureHunt } from "./schemas";
import { MAX_ITEMS_PER_BOOK } from "./limits";
import { HIDING_PLACES } from "./prompts";

type Ctx = Record<string, unknown>;
const s = (v: unknown, d: string) => (typeof v === "string" && v.trim() ? v : d);
const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

const PLACES = ["frigo", "canapé", "lave-linge", "chaussures de l'entrée", "pot de plante", "baignoire", "étagère à livres", "boîte aux lettres", "oreiller", "coffre à jouets", "tiroir à couverts", "panier à linge"];
const RIDDLES: Record<string, string> = {
  frigo: "Je suis froid comme la banquise, je garde le lait et les fruits. Ouvre l'œil sur ma porte !",
  canapé: "On s'assoit sur moi pour regarder des dessins animés. Glisse ta main sous mes coussins !",
  "lave-linge": "Je tourne, je tourne, je fais des bulles. Les chaussettes font du manège chez moi !",
  "chaussures de l'entrée": "Le matin, vous mettez vos pieds dedans. Le soir, je dors dans l'entrée.",
  "pot de plante": "J'ai les pieds dans la terre et je bois de l'eau. Cherche sous mes feuilles !",
  baignoire: "Je suis pleine d'eau le soir et de canards en plastique. Regarde au fond de moi !",
  "étagère à livres": "Je porte des histoires sur mon dos. Cherche entre deux d'entre elles !",
  "boîte aux lettres": "Le facteur me rend visite chaque jour. Ouvre ma petite porte !",
  oreiller: "Toute la nuit, ta tête se pose sur moi. Soulève-moi doucement !",
  "coffre à jouets": "Je garde tes trésors préférés : voitures, poupées et ballons.",
  "tiroir à couverts": "Fourchettes et cuillères dorment chez moi, bien rangées.",
  "panier à linge": "Je mange les vêtements sales… mais je ne les digère pas !",
};

/** Univers proposés dans le contexte du prompt de plan : « slug:preset,slug:preset ». */
function contextSites(ctx: Ctx): { slug: string; preset: string }[] {
  return s(ctx.sites, "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [slug, preset] = x.split(":");
      return { slug, preset: preset ?? "" };
    });
}

function pickSite(ctx: Ctx, preset: string): string | undefined {
  const sites = contextSites(ctx);
  return (sites.find((x) => x.preset === preset) ?? sites.find((x) => x.preset === "kit-enfants") ?? sites[0])?.slug;
}

export function mockKitPlan(ctx: Ctx): KitPlan {
  const brief = s(ctx.brief, "").toLowerCase();
  if (/piscine|guide|eau verte|entretien|bricolage maison|jardin potager/.test(brief)) {
    const pool = /piscine|eau verte/.test(brief);
    return {
      kitType: "guide-pratique",
      title: pool ? "[DÉMO] Fini l'eau verte : retrouver une piscine claire en 72 h" : "[DÉMO] Le guide pratique pas à pas",
      subtitle: pool ? "Diagnostic, traitement de choc et routine d'entretien, étape par étape" : "Comprendre, agir, prévenir",
      ageRange: "18-99",
      universe: pool ? "Piscine" : "Maison",
      heroName: "",
      heroDescription: "",
      companion: "",
      place: "",
      tone: "Clair, rassurant, concret",
      count: 8,
      priceCents: 1490,
      shopCategorySlug: "guides-pratiques",
      siteSlug: pickSite(ctx, "guide-expert"),
      notes: "[DÉMO] Plan généré hors ligne à partir du brief.",
    };
  }
  if (/coloriage|colorier/.test(brief)) {
    const m = /(\d{1,3})\s*(dessins|coloriages|pages)/.exec(brief);
    const universe = /dino/.test(brief) ? "Dinosaures" : /licorne/.test(brief) ? "Licornes" : /espace/.test(brief) ? "Espace" : /animal|ferme/.test(brief) ? "Animaux de la ferme" : "Dinosaures";
    const count = Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, m ? Number(m[1]) : 30));
    const age = /4\s*(?:-|à)\s*6|3\s*(?:-|à)\s*5/.test(brief) ? "3-5" : /8\s*(?:-|à)\s*10/.test(brief) ? "8-10" : "5-8";
    return {
      kitType: "cahier-coloriage", title: `[DÉMO] Mon grand cahier de coloriage — ${universe}`, subtitle: `${count} dessins à colorier`, ageRange: age,
      universe, heroName: "", heroDescription: "", companion: "", place: "", tone: "Joyeux et tendre", count, priceCents: 590,
      shopCategorySlug: "activites-educatives", siteSlug: pickSite(ctx, "kit-enfants"), notes: "[DÉMO] Plan généré hors ligne à partir du brief.",
    };
  }
  if (/recette|cuisine|goûter|gouter|repas|pâtisserie|patisserie/.test(brief)) {
    return {
      kitType: "livre-recettes", title: "[DÉMO] Goûters maison en 20 minutes", subtitle: "Des recettes simples pour tous les jours", ageRange: "18-99",
      universe: "Cuisine", heroName: "", heroDescription: "", companion: "", place: "", tone: "Gourmand et simple", count: 12, priceCents: 990,
      shopCategorySlug: "recettes", siteSlug: pickSite(ctx, "recettes"), notes: "[DÉMO] Plan généré hors ligne à partir du brief.",
    };
  }
  if (/expérience|experience|science|labo|chimie|physique/.test(brief)) {
    return {
      kitType: "fiches-sciences", title: "[DÉMO] Le labo des curieux : 12 expériences à la maison", subtitle: "Des expériences simples et sûres avec le matériel de la cuisine", ageRange: "6-10",
      universe: "Laboratoire", heroName: "Docteure Éprouvette", heroDescription: "[DÉMO] scientifique enjouée en blouse violette", companion: "", place: "", tone: "Curieux et enthousiaste", count: 12, priceCents: 790,
      shopCategorySlug: "activites-educatives", siteSlug: pickSite(ctx, "sciences-enfants"), notes: "[DÉMO] Plan généré hors ligne à partir du brief.",
    };
  }
  const isPranks = /lutin|farce|noël|noel/.test(brief);
  const universe = /dino/.test(brief) ? "Dinosaures" : /espace|astronaut|fusée/.test(brief) ? "Espace" : /pirate/.test(brief) ? "Pirates" : isPranks ? "Noël" : "Forêt enchantée";
  return {
    kitType: isPranks ? "lutins-farceurs" : "chasse-au-tresor",
    title: isPranks ? "[DÉMO] Lutins farceurs : 30 idées pour Noël" : `[DÉMO] La grande chasse au trésor — ${universe}`,
    subtitle: isPranks ? "30 farces tendres et rapides jusqu'à Noël" : "10 énigmes, une carte secrète et un trésor à trouver à la maison",
    ageRange: isPranks ? "3-10" : "5-8",
    universe,
    heroName: isPranks ? "Pompon" : universe === "Dinosaures" ? "Professeure Fossile" : universe === "Espace" ? "Commandante Stella" : "Capitaine Plume",
    heroDescription: "[DÉMO] personnage guide souriant",
    companion: isPranks ? "Guimauve, sa cousine" : universe === "Dinosaures" ? "Pépite, bébé tricératops" : universe === "Espace" ? "Boulon, petit robot" : "Noisette, l'écureuil",
    place: "",
    tone: "Joyeux et complice",
    count: isPranks ? 30 : 10,
    priceCents: isPranks ? 790 : 990,
    shopCategorySlug: isPranks ? "evenements" : "chasses-au-tresor",
    siteSlug: pickSite(ctx, "kit-enfants"),
    notes: "[DÉMO] Plan généré hors ligne à partir du brief.",
  };
}

export function mockTreasureHunt(ctx: Ctx): TreasureHunt {
  const count = Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, n(ctx.count, 10)));
  const hero = s(ctx.heroName, "Capitaine Plume");
  const companion = s(ctx.companion, "Noisette");
  const title = s(ctx.title, "[DÉMO] La grande chasse au trésor");
  const universe = s(ctx.universe, "aventure");
  const places = Array.from({ length: count }, (_, i) => (i < HIDING_PLACES.length ? HIDING_PLACES[i] : `${HIDING_PLACES[i % HIDING_PLACES.length]} (${Math.floor(i / HIDING_PLACES.length) + 1})`));
  const enigmes = places.map((cachette, i) => ({
    numero: i + 1,
    cachette,
    texte: `[DÉMO] ${RIDDLES[cachette] ?? "Cherche bien autour de toi !"}`,
    indice_secours: `${companion.split(",")[0]} dit : cherche du côté du ${cachette} !`,
    image_description: `Un ${cachette} dans une maison chaleureuse, avec un petit parchemin roulé et noué d'un ruban rouge bien visible, univers ${universe}.`,
  }));
  return {
    titre: title,
    sous_titre: "[DÉMO] 10 énigmes, une carte secrète et un trésor à trouver à la maison",
    personnage: { nom: hero, description: "[DÉMO] personnage guide souriant", compagnon: companion, vehicule: s(ctx.place, "") },
    lettre: `[DÉMO] Bonjour les aventuriers ! Ici ${hero}. Cette nuit, j'ai caché mon trésor dans votre maison. Pour le retrouver, résolvez mes ${count} énigmes : chacune vous mènera à une cachette et vous donnera un morceau de ma carte secrète. ${companion.split(",")[0]} vous surveille et peut donner un indice si vous êtes bloqués. Quand vous aurez tous les morceaux, la carte vous montrera où dort le trésor. Bonne chance !`,
    enigmes,
    carte: { titre: "[DÉMO] Carte secrète", consigne_parent: "Avant de découper : écrivez la cachette du trésor dans le cadre sous le X.", image_description: `Carte au trésor illustrée, univers ${universe}, avec un X rouge et un cadre vide.` },
    defis: ["Statue", "Cri de victoire", "Marche à reculons", "Chuchoteurs", "Équilibriste", "Danse de la joie"].map((t) => ({ titre: t, consigne: `[DÉMO] Défi « ${t} » : tout le monde le réalise ensemble pendant 10 secondes.` })),
    diplome: { titre: "[DÉMO] Diplôme d'aventurier", texte: `Par ordre de ${hero}, … est nommé(e) aventurier officiel pour avoir retrouvé le trésor avec courage et malice.` },
    invitation: { titre: "[DÉMO] Ahoy !", texte: `${hero} recrute une équipe pour l'anniversaire de … Tenue d'aventurier bienvenue !` },
    guide: {
      materiel: ["Ce kit imprimé", "Ciseaux et ruban adhésif", "Une boîte à chaussures décorée : le coffre", "Le trésor : bonbons, petits cadeaux"],
      preparation: ["Imprimez le kit", "Découpez les cartes et la carte au trésor", "Scotchez chaque morceau au dos de la carte suivante", "Cachez les cartes selon le plan"],
      cachettes: enigmes.slice(1).map((e) => ({ carte: e.numero, cachette: e.cachette, variante: "[DÉMO] variante si absent" })),
      deroule: ["Lisez la lettre", "Les enfants résolvent la carte 1", "Chaque cachette donne la carte suivante et un morceau", "La carte complète révèle le trésor"],
      adaptations: ["5–6 ans : cartes images lues à voix haute", "7–8 ans : cartes texte", "Plus de 6 enfants : deux équipes"],
      securite: ["Un adulte reste présent", "Pas de cachette en hauteur", "Pas de petits objets avant 3 ans"],
    },
    illustrations: [
      { page: "couverture", prompt: `[DÉMO] Couverture : ${hero} devant un coffre au trésor, univers ${universe}` },
      { page: "lettre", prompt: `[DÉMO] ${hero} écrivant une lettre` },
      { page: "carte", prompt: `[DÉMO] Carte au trésor, univers ${universe}` },
      { page: "diplome", prompt: `[DÉMO] ${hero} saluant, décor de fête` },
      ...enigmes.map((e) => ({ page: `enigme-image-${e.numero}`, prompt: e.image_description })),
    ],
    boutique: {
      tagline: "[DÉMO] 10 énigmes, une carte secrète et un trésor à trouver à la maison",
      shortDescription: `[DÉMO] Kit de chasse au trésor à imprimer, univers ${universe}.`,
      tags: [universe.toLowerCase(), "chasse au trésor", "à imprimer"],
    },
  };
}

export function mockPranksKit(ctx: Ctx): PranksKit {
  const count = Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, n(ctx.count, 30)));
  const hero = s(ctx.heroName, "Pompon");
  const idees = Array.from({ length: count }, (_, i) => ({
    numero: i + 1,
    titre: `[DÉMO] Farce n° ${i + 1}`,
    resume: "[DÉMO] Une farce tendre et rapide à installer la veille au soir.",
    materiel: ["Papier", "Feutres"],
    preparation: ["Préparez le matériel", "Installez la farce", "Laissez le petit mot du lutin"],
    temps_minutes: 5,
    difficulte: 1 + (i % 3),
    age_conseille: i % 2 ? "5+" : "3+",
    message_du_lutin: `[DÉMO] Coucou ! C'est ${hero} !`,
    variante_sans_materiel: null,
    illustration_description: `${hero}, petit lutin farceur, en train de préparer une farce n° ${i + 1}`,
  }));
  return {
    titre: s(ctx.title, "[DÉMO] Lutins farceurs : 30 idées pour Noël"),
    sous_titre: "[DÉMO] 30 farces tendres et rapides",
    personnages: [{ nom: hero, description: "[DÉMO] lutin au bonnet rouge" }],
    lettre_arrivee: `[DÉMO] Coucou les enfants ! Je m'appelle ${hero} et j'arrive tout droit du pôle Nord. La journée, je vous observe ; la nuit, je fais des bêtises. Règle d'or : on ne me touche pas, sinon je perds ma magie ! Je repartirai la veille de Noël.`,
    idees,
    idees_reserve: Array.from({ length: 6 }, (_, i) => ({ titre: `[DÉMO] Idée de réserve ${i + 1}`, resume: "Pour les soirs pressés." })),
    mots_du_lutin: Array.from({ length: 10 }, (_, i) => `[DÉMO] Petit mot n° ${i + 1} de ${hero}`),
    lettre_depart: `[DÉMO] Mes chers amis, c'est déjà l'heure de repartir. Merci pour ce mois de rires ! À l'année prochaine. ${hero}`,
    certificat: { titre: "[DÉMO] Famille officiellement farceuse", texte: "La famille … est officiellement farceuse !" },
    guide_parents: { introduire: ["3–4 ans : rituel court", "5–7 ans : mots et énigmes", "8–10 ans : le secret"], oubli: "Pompon a eu une panne de magie !", organisation: ["Préparez 5 farces d'avance"], securite: ["Rien de dangereux à portée des moins de 3 ans"] },
    illustrations: [
      { page: "couverture", prompt: `[DÉMO] ${hero}, lutin farceur, sapin de Noël` },
      { page: "lettre-arrivee", prompt: `[DÉMO] ${hero} arrivant avec sa valise` },
      ...idees.map((i) => ({ page: `idee-${i.numero}`, prompt: i.illustration_description })),
    ],
    boutique: { tagline: "[DÉMO] 30 farces tendres et rapides pour faire vivre votre lutin", tags: ["lutin farceur", "noël"] },
  };
}

// ---------------------------------------------------------------------------
// Guide pratique (adultes)
// ---------------------------------------------------------------------------

const POOL_CHAPTERS: { titre: string; resume: string; contenu: string; etapes: string[]; conseil: string; attention: string; tableau?: { titre: string; colonnes: string[]; lignes: string[][] } }[] = [
  {
    titre: "Comprendre pourquoi l'eau verdit",
    resume: "L'eau verte est presque toujours due à des algues qui profitent d'un désinfectant insuffisant.",
    contenu: "Les algues se développent quand le désinfectant ne fait plus son travail : chlore épuisé, pH trop élevé qui le rend moins efficace, filtration trop courte ou chaleur prolongée. Comprendre la cause évite de traiter « à l'aveugle » et de recommencer la semaine suivante.",
    etapes: ["Notez depuis quand l'eau a changé de couleur", "Repérez les événements récents : orage, canicule, forte fréquentation", "Vérifiez que la pompe et la filtration tournent normalement"],
    conseil: "Une eau verte n'est pas une fatalité : dans la grande majorité des cas, un traitement méthodique suffit.",
    attention: "Ne vous baignez pas dans une eau verte ou trouble : la désinfection n'est plus assurée.",
  },
  {
    titre: "Faire le diagnostic de l'eau",
    resume: "Mesurer le pH et le désinfectant avant toute chose.",
    contenu: "Avant d'ajouter le moindre produit, mesurez. Une trousse d'analyse (bandelettes ou kit à gouttes) permet de connaître le pH et le taux de désinfectant. Ces deux valeurs orientent tout le traitement.",
    etapes: ["Prélevez l'eau à environ 30 cm sous la surface, loin des buses de refoulement", "Mesurez le pH puis le désinfectant selon la notice de votre trousse", "Notez les résultats avec la date et l'heure"],
    conseil: "Gardez un carnet de bord : vos mesures successives vous diront si le traitement fonctionne.",
    attention: "Respectez la date de péremption des bandelettes : périmées, elles donnent des valeurs fausses.",
    tableau: { titre: "Repères usuels (à confirmer avec la notice de vos produits)", colonnes: ["Mesure", "Plage habituellement recommandée", "Si hors plage"], lignes: [["pH", "7,0 à 7,4", "Corriger avant tout traitement"], ["Désinfectant", "Selon la notice du produit", "Traitement de choc si effondré"]] },
  },
  {
    titre: "Nettoyer avant de traiter",
    resume: "Retirer feuilles et dépôts pour que le traitement agisse là où il faut.",
    contenu: "Les débris organiques consomment le désinfectant. Retirez-les d'abord : vous économiserez du produit et le traitement sera plus rapide.",
    etapes: ["Retirez les feuilles et débris à l'épuisette", "Brossez parois, ligne d'eau et fond", "Videz les paniers de skimmer et de pompe"],
    conseil: "Brossez du haut vers le bas, en direction de la bonde de fond.",
    attention: "Coupez la pompe avant d'ouvrir le préfiltre.",
  },
  {
    titre: "Corriger le pH",
    resume: "Un pH dans la bonne plage rend le désinfectant beaucoup plus efficace.",
    contenu: "Le pH conditionne l'efficacité du chlore. Corrigez-le en plusieurs fois, en laissant circuler l'eau entre deux ajouts, puis mesurez à nouveau.",
    etapes: ["Calculez la dose selon le volume du bassin et la notice du produit", "Diluez si la notice l'indique et versez devant les buses de refoulement, filtration en marche", "Attendez le délai indiqué sur l'étiquette puis mesurez à nouveau"],
    conseil: "Corriger par petites doses évite de dépasser la valeur visée.",
    attention: "Ne mélangez jamais deux produits chimiques entre eux, même dans un seau d'eau.",
  },
  {
    titre: "Réaliser le traitement de choc",
    resume: "Une dose renforcée de désinfectant pour détruire les algues.",
    contenu: "Le traitement de choc consiste à augmenter fortement et temporairement le taux de désinfectant. Suivez strictement le dosage de l'étiquette pour le volume de votre bassin.",
    etapes: ["Calculez le volume de votre bassin (longueur × largeur × profondeur moyenne)", "Dosez le produit de choc selon l'étiquette, sans l'augmenter « pour être sûr »", "Ajoutez-le de préférence en soirée, filtration en marche continue"],
    conseil: "Le soir, le soleil détruit moins le chlore : le traitement agit plus longtemps.",
    attention: "Portez gants et lunettes, travaillez à l'air libre et rangez les produits hors de portée des enfants.",
  },
  {
    titre: "Filtrer en continu et nettoyer le filtre",
    resume: "La filtration retire les algues mortes ; le filtre doit rester propre.",
    contenu: "Pendant le traitement, laissez la filtration tourner en continu. Les algues détruites colmatent le filtre : surveillez le manomètre et nettoyez ou lavez-le selon sa technologie (sable, cartouche, diatomée).",
    etapes: ["Laissez la filtration tourner jour et nuit pendant le traitement", "Surveillez la pression au manomètre", "Lavez le filtre (contre-lavage ou rinçage de la cartouche) selon la notice de l'équipement"],
    conseil: "Un manomètre qui monte nettement signale un filtre à nettoyer.",
    attention: "Arrêtez la pompe avant de manipuler la vanne multivoies.",
  },
  {
    titre: "Clarifier et aspirer",
    resume: "Récupérer les particules fines qui troublent l'eau après le choc.",
    contenu: "Après le choc, l'eau passe souvent du vert au trouble puis au bleu. Un clarifiant ou un floculant peut aider le filtre ; aspirez ensuite les dépôts au fond du bassin.",
    etapes: ["Ajoutez un clarifiant si l'eau reste trouble, selon la notice", "Laissez reposer le temps indiqué", "Aspirez soigneusement le fond"],
    conseil: "Patience : un retour à une eau limpide demande généralement plusieurs cycles de filtration.",
    attention: "N'utilisez pas de floculant avec un filtre à cartouche si la notice le déconseille.",
  },
  {
    titre: "Prévenir le retour de l'eau verte",
    resume: "Une routine simple chaque semaine pour garder une eau claire.",
    contenu: "La prévention coûte moins cher et demande moins d'efforts qu'un rattrapage. Mesurez régulièrement, adaptez la durée de filtration à la température de l'eau et entretenez le filtre.",
    etapes: ["Mesurez pH et désinfectant au moins une fois par semaine, plus souvent par forte chaleur", "Adaptez la durée de filtration à la température de l'eau", "Nettoyez skimmers et ligne d'eau chaque semaine"],
    conseil: "Après un orage ou une forte fréquentation, faites une mesure supplémentaire.",
    attention: "Conservez les produits au frais, au sec et dans leur emballage d'origine.",
  },
];

export function mockGuide(ctx: Ctx): Guide {
  const count = Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, n(ctx.count, 8)));
  const title = s(ctx.title, "[DÉMO] Fini l'eau verte : retrouver une piscine claire en 72 h");
  const chapitres = Array.from({ length: count }, (_, i) => {
    const base = POOL_CHAPTERS[i % POOL_CHAPTERS.length];
    return {
      numero: i + 1,
      titre: `[DÉMO] ${base.titre}${i >= POOL_CHAPTERS.length ? ` (suite ${Math.floor(i / POOL_CHAPTERS.length) + 1})` : ""}`,
      resume: base.resume,
      contenu: base.contenu,
      etapes: base.etapes,
      conseil: base.conseil,
      attention: base.attention,
      tableau: base.tableau ?? null,
      illustration_description: `Illustration vectorielle sobre : ${base.titre.toLowerCase()}, piscine familiale, tons bleu et sarcelle`,
    };
  });
  return {
    titre: title,
    sous_titre: "[DÉMO] Diagnostic, traitement de choc et routine d'entretien, étape par étape",
    auteur: { nom: "La rédaction", expertise: "[DÉMO] Conseils d'entretien rédigés pour les particuliers" },
    introduction: "[DÉMO] Votre piscine a viré au vert ? Pas de panique. Ce guide vous accompagne pas à pas : comprendre la cause, mesurer l'eau, traiter méthodiquement puis mettre en place une routine simple. Le délai de retour à une eau claire dépend de votre bassin, de votre équipement et de la météo : suivez les étapes, mesurez, et ajustez.",
    probleme: { titre: "[DÉMO] Une eau verte, que se passe-t-il ?", texte: "Une eau verte signale le développement d'algues : la désinfection n'est plus suffisante. La bonne nouvelle : la cause est presque toujours identifiable et le traitement suit une méthode claire." },
    causes: [
      { titre: "Désinfectant épuisé", explication: "Le chlore se consomme avec la chaleur, le soleil, la baignade et les débris." },
      { titre: "pH trop élevé", explication: "Au-dessus de la plage recommandée, le chlore perd beaucoup de son efficacité." },
      { titre: "Filtration insuffisante", explication: "Une durée trop courte ou un filtre encrassé laisse les algues s'installer." },
    ],
    diagnostic: [
      { question: "L'eau est-elle verte mais vous voyez encore le fond ?", si_oui: "Algues débutantes : corrigez le pH puis traitement de choc.", si_non: "Eau très chargée : nettoyez d'abord, puis traitez par étapes." },
      { question: "Le pH est-il hors de la plage recommandée ?", si_oui: "Corrigez le pH avant tout autre produit.", si_non: "Passez directement au traitement de choc." },
    ],
    chapitres,
    erreurs: [
      { erreur: "Ajouter du produit sans mesurer", solution: "Mesurez toujours pH et désinfectant avant de traiter." },
      { erreur: "Mélanger deux produits", solution: "Ajoutez-les séparément, dans l'eau du bassin, à plusieurs heures d'intervalle et selon les notices." },
      { erreur: "Arrêter la filtration la nuit pendant le traitement", solution: "Filtrez en continu jusqu'au retour d'une eau claire." },
    ],
    checklist: { titre: "[DÉMO] Ma checklist « eau claire »", items: ["Débris retirés", "Parois brossées", "pH mesuré et corrigé", "Traitement de choc dosé selon l'étiquette", "Filtration en continu", "Filtre nettoyé", "Nouvelle mesure le lendemain"] },
    calendrier: [
      { periode: "Jour 1", actions: ["Nettoyage", "Mesures", "Correction du pH", "Traitement de choc le soir"] },
      { periode: "Jour 2", actions: ["Filtration continue", "Nettoyage du filtre", "Nouvelle mesure"] },
      { periode: "Jour 3", actions: ["Clarifiant si besoin", "Aspiration du fond", "Mesure avant baignade"] },
    ],
    faq: [
      { question: "Quand pourrai-je me baigner à nouveau ?", reponse: "Lorsque l'eau est redevenue claire et que vos mesures sont revenues dans les plages indiquées par la notice de vos produits." },
      { question: "Faut-il vider la piscine ?", reponse: "Rarement. Une vidange se décide au cas par cas, idéalement avec l'avis d'un professionnel, car elle peut abîmer certains bassins." },
    ],
    glossaire: [
      { terme: "pH", definition: "Mesure de l'acidité de l'eau ; il conditionne l'efficacité du désinfectant." },
      { terme: "Traitement de choc", definition: "Apport ponctuel et renforcé de désinfectant pour détruire les algues." },
      { terme: "Contre-lavage", definition: "Inversion du sens de l'eau dans un filtre à sable pour le nettoyer." },
    ],
    securite: [
      "Lisez et respectez l'étiquette de chaque produit : dosage, précautions, délais.",
      "Ne mélangez jamais deux produits chimiques entre eux.",
      "Portez gants et lunettes de protection ; travaillez à l'air libre.",
      "Stockez les produits hors de portée des enfants et des animaux, au frais et au sec.",
      "En cas de doute, demandez conseil à un professionnel de la piscine.",
    ],
    illustrations: [
      { page: "couverture", prompt: "[DÉMO] Piscine familiale passant du vert au bleu limpide, illustration vectorielle éditoriale" },
      { page: "guide-probleme", prompt: "[DÉMO] Bassin à l'eau verte, feuilles en surface, ciel d'été" },
      ...chapitres.map((c) => ({ page: `chapitre-${c.numero}`, prompt: c.illustration_description })),
    ],
    boutique: {
      tagline: "[DÉMO] La méthode pas à pas pour retrouver une eau claire",
      shortDescription: "[DÉMO] Guide pratique à télécharger : diagnostic, traitement et routine d'entretien.",
      tags: ["piscine", "eau verte", "entretien", "guide pratique"],
    },
  };
}

// ---------------------------------------------------------------------------
// Livre de recettes
// ---------------------------------------------------------------------------

export function mockRecipes(ctx: Ctx): Recipes {
  const count = Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, n(ctx.count, 12)));
  const recettes = Array.from({ length: count }, (_, i) => ({
    numero: i + 1,
    titre: `[DÉMO] Recette n° ${i + 1}`,
    resume: "[DÉMO] Une recette simple et rapide.",
    portions: 4,
    temps_preparation_minutes: 15,
    temps_cuisson_minutes: i % 2 ? 20 : 0,
    difficulte: 1 + (i % 3),
    ingredients: ["200 g de farine", "2 œufs", "20 cl de lait"],
    etapes: ["Mélangez les ingrédients secs", "Ajoutez les œufs puis le lait", "Faites cuire ou servez frais"],
    astuce: "[DÉMO] Préparez la pâte la veille pour gagner du temps.",
    allergenes: ["gluten", "œuf", "lait"],
    illustration_description: `Plat appétissant n° ${i + 1}, vue de dessus, nappe à carreaux`,
  }));
  return {
    titre: s(ctx.title, "[DÉMO] Goûters maison en 20 minutes"),
    sous_titre: "[DÉMO] Des recettes simples pour tous les jours",
    introduction: "[DÉMO] Ce livre rassemble des recettes simples, testées pour la vie de tous les jours. Chaque fiche indique les portions, les temps et les allergènes principaux.",
    recettes,
    conseils: ["Lisez la recette en entier avant de commencer", "Préparez tous les ingrédients à l'avance"],
    illustrations: [{ page: "couverture", prompt: "[DÉMO] Table de goûter gourmande" }],
    boutique: { tagline: "[DÉMO] Des recettes simples pour tous les jours", tags: ["recettes", "cuisine"] },
  };
}

// ---------------------------------------------------------------------------
// Fiches d'expériences scientifiques
// ---------------------------------------------------------------------------

export function mockScience(ctx: Ctx): Science {
  const count = Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, n(ctx.count, 12)));
  const hero = s(ctx.heroName, "Docteure Éprouvette");
  const experiences = Array.from({ length: count }, (_, i) => ({
    numero: i + 1,
    titre: `[DÉMO] Expérience n° ${i + 1}`,
    question: "[DÉMO] Que va-t-il se passer ?",
    materiel: ["Un verre", "De l'eau", "Du sel"],
    etapes: ["Remplis le verre d'eau", "Ajoute une cuillère de sel", "Observe bien"],
    explication: "[DÉMO] Le sel se dissout dans l'eau : il est toujours là, mais tu ne le vois plus !",
    pour_aller_plus_loin: "[DÉMO] Essaie avec du sucre ou de l'eau chaude.",
    securite: ["Un adulte reste à côté"],
    duree_minutes: 15,
    difficulte: 1 + (i % 3),
    age_conseille: "6+",
    illustration_description: `${hero} réalisant l'expérience n° ${i + 1} dans une cuisine lumineuse`,
  }));
  return {
    titre: s(ctx.title, "[DÉMO] Le labo des curieux : 12 expériences à la maison"),
    sous_titre: "[DÉMO] Des expériences simples et sûres",
    personnage: { nom: hero, description: "[DÉMO] scientifique enjouée en blouse violette" },
    introduction: `[DÉMO] Bonjour, jeunes scientifiques ! Je suis ${hero}. Avec un adulte, vous allez réaliser des expériences étonnantes avec le matériel de la cuisine.`,
    experiences,
    diplome: { titre: "[DÉMO] Diplôme de jeune scientifique", texte: "… a réalisé toutes les expériences du labo des curieux !" },
    securite_generale: ["Toujours avec un adulte", "On ne goûte pas les expériences", "On se lave les mains après"],
    illustrations: [{ page: "couverture", prompt: `[DÉMO] ${hero} entourée d'éprouvettes colorées` }],
    boutique: { tagline: "[DÉMO] Des expériences simples et sûres à la maison", tags: ["sciences", "expériences", "enfants"] },
  };
}

// ---------------------------------------------------------------------------
// Cahier de coloriage et rédaction par lots (démonstration)
// ---------------------------------------------------------------------------

const DINO_SUBJECTS = ["Tricératops qui mange des feuilles", "Bébé T-rex qui sort de son œuf", "Diplodocus au long cou près d'un lac", "Ptérodactyle qui vole au-dessus d'un volcan", "Stégosaure qui fait la sieste", "Ankylosaure et sa queue en massue", "Maman dinosaure et son petit", "Dinosaure qui joue au ballon", "Œufs de dinosaure dans un nid", "Brachiosaure qui croque une branche", "Vélociraptor qui court", "Dinosaure sous la pluie avec un parapluie", "Fossile dans la roche", "Dinosaure qui fête son anniversaire", "Parasaurolophus qui chante", "Petit dinosaure dans une flaque", "Dinosaure astronaute", "Dinosaure qui lit un livre", "Iguanodon et une fleur", "Dinosaure pirate sur un radeau"];
const POSES = ["de face", "de profil", "en gros plan", "avec un papillon", "près d'un palmier", "sous le soleil", "la nuit sous les étoiles", "dans la jungle", "au bord de la mer", "en train de danser"];

function drawingSubject(i: number, universe: string): string {
  const base = /dino/i.test(universe) ? DINO_SUBJECTS[i % DINO_SUBJECTS.length] : `${universe} : scène ${i + 1}`;
  const round = Math.floor(i / DINO_SUBJECTS.length);
  return round ? `${base}, ${POSES[(i + round) % POSES.length]}` : base;
}

export function mockColoring(ctx: Ctx): Coloring {
  const count = Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, n(ctx.count, 30)));
  const universe = s(ctx.universe, "Dinosaures");
  const titles = Array.isArray(ctx.titles) ? (ctx.titles as string[]) : [];
  return {
    titre: s(ctx.title, `[DÉMO] Mon cahier de coloriage — ${universe}`),
    sous_titre: `[DÉMO] ${count} dessins à colorier`,
    theme: universe,
    introduction: "[DÉMO] Choisis un dessin, prends tes crayons et amuse-toi ! Conseil aux parents : imprimez sur du papier 120 g pour les feutres.",
    dessins: Array.from({ length: count }, (_, i) => {
      const titre = titles[i] ?? drawingSubject(i, universe);
      return { numero: i + 1, titre, description: `[DÉMO] ${titre}, au centre de la page, sourire, décor simple.`, legende: "", niveau_detail: "moyen" as const };
    }),
    page_appartient: { titre: "Ce cahier appartient à", texte: "Écris ton prénom et dessine-toi !" },
    diplome: { titre: "Diplôme d'artiste en herbe", texte: "[DÉMO] a colorié tout son cahier avec talent et imagination." },
    conseils: ["[DÉMO] Imprimez une page à la fois.", "[DÉMO] Papier 120 g conseillé pour les feutres."],
    illustrations: [{ page: "couverture", prompt: `[DÉMO] Couverture en couleur : des ${universe.toLowerCase()} joyeux et des crayons de couleur.` }],
    boutique: { name: `[DÉMO] Cahier de coloriage ${universe}`, shortDescription: `[DÉMO] ${count} dessins à imprimer.`, tags: ["coloriage", universe.toLowerCase()] },
  };
}

/** Contenu du format demandé, pour un nombre d'éléments donné (démonstration). */
function mockForFormat(format: string, ctx: Ctx): Record<string, unknown> {
  switch (format) {
    case "treasure_hunt": return mockTreasureHunt(ctx);
    case "pranks": return mockPranksKit(ctx);
    case "guide": return mockGuide(ctx);
    case "recipes": return mockRecipes(ctx);
    case "science": return mockScience(ctx);
    default: return mockColoring(ctx);
  }
}

const KEYS: Record<string, string> = { treasure_hunt: "enigmes", pranks: "idees", guide: "chapitres", recipes: "recettes", science: "experiences", coloring: "dessins" };

/** Sommaire de démonstration (rédaction par lots). */
export function mockOutline(ctx: Ctx): { elements: Array<{ numero: number; titre: string; idee: string }> } {
  const format = s(ctx.format, "coloring");
  const count = Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, n(ctx.count, 30)));
  const items = (mockForFormat(format, { ...ctx, count })[KEYS[format]] as Array<Record<string, unknown>>) ?? [];
  return { elements: items.map((it, i) => ({ numero: i + 1, titre: String(it.titre ?? it.cachette ?? `Élément ${i + 1}`), idee: "[DÉMO]" })) };
}

/** Lot d'éléments de démonstration (numéros from..to, titres du sommaire). */
export function mockItems(ctx: Ctx): { items: Array<Record<string, unknown>> } {
  const format = s(ctx.format, "coloring");
  const from = Math.max(1, n(ctx.from, 1));
  const to = Math.max(from, n(ctx.to, from));
  const titles = Array.isArray(ctx.titles) ? (ctx.titles as string[]) : [];
  const all = (mockForFormat(format, { ...ctx, count: to, titles: undefined })[KEYS[format]] as Array<Record<string, unknown>>) ?? [];
  return {
    items: all.slice(from - 1, to).map((it, i) => {
      const t = titles[i];
      if (!t) return it;
      if (format === "treasure_hunt") return { ...it, cachette: t };
      if (format === "coloring") return { ...it, titre: t, description: `[DÉMO] ${t}, au centre de la page, sourire, décor simple.` };
      return { ...it, titre: t };
    }),
  };
}
