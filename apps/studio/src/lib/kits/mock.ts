/**
 * Contenus de démonstration (fournisseur « mock ») pour les kits : plausibles, structurés,
 * explicitement marqués comme générés hors ligne. Ils permettent de tester tout le parcours
 * kit → illustrations → pages → PDF sans clé API.
 */
import type { KitPlan, PranksKit, TreasureHunt } from "./schemas";

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

export function mockKitPlan(ctx: Ctx): KitPlan {
  const brief = s(ctx.brief, "").toLowerCase();
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
    notes: "[DÉMO] Plan généré hors ligne à partir du brief.",
  };
}

export function mockTreasureHunt(ctx: Ctx): TreasureHunt {
  const count = Math.max(1, Math.min(12, n(ctx.count, 10)));
  const hero = s(ctx.heroName, "Capitaine Plume");
  const companion = s(ctx.companion, "Noisette");
  const title = s(ctx.title, "[DÉMO] La grande chasse au trésor");
  const universe = s(ctx.universe, "aventure");
  const enigmes = PLACES.slice(0, count).map((cachette, i) => ({
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
  const count = Math.max(1, Math.min(40, n(ctx.count, 30)));
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
