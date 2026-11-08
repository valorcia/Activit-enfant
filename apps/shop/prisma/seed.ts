/**
 * Seed : compte administrateur, catégories, collections, paramètres du site,
 * pages juridiques (brouillons à valider) et le premier produit
 * « Le trésor de la Capitaine Coquelicot ».
 *
 * Les illustrations et PDF définitifs seront fournis ultérieurement : les
 * emplacements sont clairement identifiés (aucune image → placeholder visuel).
 * Aucune caractéristique commerciale non confirmée n'est inventée : les champs
 * à compléter sont préfixés « [À COMPLÉTER] ».
 *
 * Variables : ADMIN_EMAIL, ADMIN_PASSWORD (obligatoires en production),
 * SEED_DEMO=1 pour ajouter des produits d'exemple (brouillons) illustrant les
 * modèles de fiche.
 */
import "dotenv/config";
import { PrismaClient, type ProductTemplate } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveDbSchema, withDbSchema } from "../src/lib/db-url";

const prisma = new PrismaClient({ datasourceUrl: withDbSchema(process.env.DATABASE_URL, resolveDbSchema()) });

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangezMoi123!";
  const existingAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  if (isProd && !process.env.ADMIN_PASSWORD && existingAdmins === 0) {
    console.warn("⚠ ADMIN_PASSWORD non défini : aucun compte administrateur créé. Définissez ADMIN_EMAIL et ADMIN_PASSWORD puis redéployez.");
  }
  // --- Administrateur (créé uniquement si un mot de passe est fourni, ou en développement) ----
  let adminId: string | null = null;
  if (!isProd || process.env.ADMIN_PASSWORD) {
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, name: "Administrateur", passwordHash: await bcrypt.hash(adminPassword, 12), role: "ADMIN" },
      update: {},
    });
    adminId = admin.id;
    console.log(`Administrateur : ${admin.email}`);
  }

  // --- Catégories ------------------------------------------------------------
  const categories = [
    { slug: "chasses-au-tresor", name: "Chasses au trésor", description: "Des aventures clés en main : énigmes, cartes, indices et diplômes à imprimer.", color: "#FF826F", icon: "map", position: 1 },
    { slug: "activites-educatives", name: "Activités éducatives", description: "Cahiers d'activités, jeux de logique, Montessori et concentration par tranche d'âge.", color: "#A8C9A1", icon: "pencil-ruler", position: 2 },
    { slug: "evenements", name: "Événements", description: "Kits d'anniversaire, Noël, Pâques, Halloween, mariages et vacances.", color: "#FFD66B", icon: "party-popper", position: 3 },
    { slug: "histoires-et-aventures", name: "Histoires et aventures", description: "Livres illustrés, histoires interactives et histoires du soir à télécharger.", color: "#C8B6E8", icon: "book-open", position: 4 },
  ];
  const catBySlug: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name, description: c.description, color: c.color, icon: c.icon, position: c.position } });
    catBySlug[c.slug] = row.id;
  }

  // --- Collections -----------------------------------------------------------
  const collections = [
    { slug: "pirates", name: "Univers Pirates", description: "Trésors, cartes et bateaux pirates.", color: "#A9D8F5", position: 1 },
    { slug: "3-5-ans", name: "3–5 ans", description: "Premières aventures pour les plus petits.", color: "#FFD66B", position: 2 },
    { slug: "5-8-ans", name: "5–8 ans", description: "Énigmes et activités pour les aventuriers en herbe.", color: "#A8C9A1", position: 3 },
    { slug: "8-10-ans", name: "8–10 ans", description: "Défis et missions pour les grands explorateurs.", color: "#C8B6E8", position: 4 },
  ];
  await prisma.collection.updateMany({ where: { slug: "8-12-ans" }, data: { slug: "8-10-ans", name: "8–10 ans" } });
  const colBySlug: Record<string, string> = {};
  for (const c of collections) {
    const row = await prisma.collection.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name, description: c.description, color: c.color, position: c.position } });
    colBySlug[c.slug] = row.id;
  }

  // --- Premier produit : Le trésor de la Capitaine Coquelicot -----------------
  // Contenu confirmé par les visuels de présentation fournis (15 pages A4, 10 énigmes en 2 versions…)
  const coquelicotData = {
    name: "Le trésor de la Capitaine Coquelicot",
    tagline: "10 énigmes, une carte secrète et un coffre à trouver à la maison",
    shortDescription: "Chasse au trésor pirates à imprimer pour les 5–8 ans : 10 énigmes en deux versions (texte ou images), une carte secrète en 10 morceaux, des défis, des invitations et des diplômes. Un seul PDF de 15 pages, prêt en 20 minutes.",
    longDescription: [
      "**Tout est dans le kit : 15 pages A4, un seul fichier PDF, rien d'autre à acheter qu'un trésor.**",
      "",
      "La Capitaine Coquelicot a caché son trésor chez vous. Les enfants résolvent 10 énigmes, rassemblent les 10 morceaux de sa carte secrète et trouvent le coffre. Préparation : 20 minutes, sans achat spécial.",
      "",
      "### 10 énigmes, 2 versions",
      "Chaque énigme existe en **version texte** (7–8 ans, pour ceux qui lisent) et en **version images** (5–6 ans, pour ceux qui ne lisent pas encore). Chaque énigme mène à une cachette de la maison : le frigo, le canapé, le lave-linge, les chaussures de l'entrée…",
      "",
      "### Une carte secrète en 10 morceaux",
      "Chaque énigme résolue donne un morceau de la carte de la Capitaine. Avec les 10 morceaux, les enfants reconstituent l'île… et le X révèle où dort le coffre ! Vous écrivez la cachette du coffre sous le X avant de découper.",
      "",
      "### Zéro prise de tête",
      "Un guide pas à pas pour l'adulte : matériel et préparation, plan des 10 cachettes avec variantes (sans jardin, sans lave-linge…), adaptations selon l'âge et le nombre d'enfants, conseils de sécurité.",
      "",
      "### Comment ça marche ?",
      "1. **Imprimez** : le PDF arrive tout de suite, imprimez en A4 chez vous (couleur ou noir et blanc).",
      "2. **Découpez et cachez** : 20 minutes avec le guide, cartes et morceaux de carte.",
      "3. **Lisez la lettre** : la Capitaine lance l'aventure, les enfants partent en mission.",
      "4. **Trouvez le trésor** : énigme après énigme, jusqu'au coffre et aux diplômes !",
    ].join("\n"),
    story: [
      "Ahoy, moussaillons !",
      "",
      "Ici la Capitaine Coquelicot, la pirate la plus rusée des sept mers. Cette nuit, une tempête a poussé mon navire, la **Sardine Volante**, jusque devant votre maison. Avant de repartir, j'ai caché mon trésor ici même. Mais attention : je l'ai bien protégé ! Pour le trouver, vous devrez résoudre dix énigmes. Chaque énigme vous donnera un morceau de ma carte secrète.",
      "",
      "Mon perroquet **Pistache** vous surveille. Il répète tout, alors travaillez en équipe et sans tricher !",
      "",
      "Quand vous aurez les dix morceaux, la carte vous dira où dort le coffre. Bonne chance, et bon vent !",
      "",
      "*Capitaine Coquelicot*",
    ].join("\n"),
    template: "ADVENTURE" as ProductTemplate,
    categoryId: catBySlug["chasses-au-tresor"],
    universe: "Pirates",
    tags: ["pirates", "chasse au trésor", "énigmes", "anniversaire", "5-8 ans", "à imprimer"],
    badges: ["Nouveau"],
    heroBadges: ["PDF A4 immédiat", "Prêt en 20 min", "5 à 8 ans", "2 à 12 enfants", "45–60 min de jeu"],
    ageMin: 5,
    ageMax: 8,
    playersMin: 2,
    playersMax: 12,
    durationMinutes: 60,
    difficulty: 2,
    pageCount: 15,
    fileFormat: "PDF A4",
    materials: ["Imprimante (couleur ou noir et blanc)", "Ciseaux et ruban adhésif", "Une boîte à chaussures décorée : le coffre", "Le trésor : bonbons, pièces en chocolat, petits cadeaux", "En option : un foulard ou un bandeau par enfant"],
    priceCents: 990, // [À CONFIRMER] prix provisoire
    currency: "EUR",
    taxRateBp: 2000,
    kitContents: [
      { title: "Guide de l'organisateur", description: "Matériel, préparation en 20 minutes, plan des 10 cachettes avec variantes, adaptations selon l'âge, conseils de sécurité.", icon: "list-checks", quantity: 2 },
      { title: "Lettre de la Capitaine", description: "Le message qui lance l'aventure, à lire aux enfants.", icon: "mail", quantity: 1 },
      { title: "10 cartes énigmes version texte", description: "Pour les 7–8 ans qui lisent seuls.", icon: "file-text", quantity: 10 },
      { title: "10 cartes énigmes version images", description: "Pour les 5–6 ans qui ne lisent pas encore : le dessin montre la cachette.", icon: "image", quantity: 10 },
      { title: "Carte au trésor en 10 morceaux", description: "À découper : chaque énigme résolue donne un morceau, le X révèle le coffre.", icon: "map", quantity: 1 },
      { title: "6 défis de pirate", description: "Jambe de bois, parole de perroquet, hissez les voiles, la chasse à l'or, cri de pirate, la planche.", icon: "sword", quantity: 6 },
      { title: "Diplômes de pirate", description: "Un diplôme de l'équipage de la Sardine Volante par enfant.", icon: "award" },
      { title: "Invitations", description: "« Ahoy, moussaillon ! » : à envoyer avant la fête.", icon: "party-popper" },
    ],
    sellingPoints: [
      { title: "Prêt en 20 minutes", description: "Imprimez, découpez, cachez : le guide vous dit tout, cachette par cachette.", icon: "timer" },
      { title: "Deux versions d'énigmes", description: "Texte pour les 7–8 ans, images pour les 5–6 ans : toute la fratrie joue ensemble.", icon: "users" },
      { title: "Rien d'autre à acheter qu'un trésor", description: "Un seul PDF de 15 pages, une imprimante, des ciseaux et une boîte à chaussures.", icon: "piggy-bank" },
      { title: "Des moments partagés", description: "45 à 60 minutes d'aventure à la maison ou au jardin, pour 2 à 12 enfants.", icon: "heart" },
      { title: "Téléchargement immédiat", description: "Vos fichiers sont disponibles dès la confirmation du paiement.", icon: "download" },
    ],
    faq: [
      { question: "Comment recevoir mon kit ?", answer: "Dès la validation du paiement, vous recevez un email avec vos liens de téléchargement. Vous pouvez aussi retrouver vos achats à tout moment depuis la page « Retrouver mes achats »." },
      { question: "Quel matériel faut-il prévoir ?", answer: "Une imprimante (couleur ou noir et blanc), des ciseaux, du ruban adhésif, une boîte à chaussures décorée pour le coffre et un trésor (bonbons, pièces en chocolat, petits cadeaux). En option, un foulard ou un bandeau par enfant." },
      { question: "Combien de temps dure la chasse au trésor ?", answer: "Comptez 20 minutes de préparation et 45 à 60 minutes de jeu." },
      { question: "Pour quel âge et combien d'enfants ?", answer: "De 5 à 8 ans, de 2 à 12 enfants. Les énigmes existent en version images (5–6 ans) et en version texte (7–8 ans). Au-delà de 6 enfants, le guide propose de former deux équipages avec des ordres de cachettes différents." },
      { question: "Et si je n'ai pas de jardin ou de lave-linge ?", answer: "Chaque cachette a une variante dans le plan des cachettes : l'énigme reste valable." },
    ],
    seoTitle: "Chasse au trésor pirates à imprimer — Capitaine Coquelicot",
    seoDescription: "Kit de chasse au trésor pirates à imprimer pour enfants de 5 à 8 ans : 10 énigmes en 2 versions, carte secrète en 10 morceaux, défis, invitations et diplômes. 15 pages PDF, téléchargement immédiat.",
    keywords: ["chasse au trésor pirate", "chasse au trésor à imprimer", "anniversaire pirate", "jeu enfant 5 ans", "énigmes enfants", "kit anniversaire à imprimer"],
    isFeatured: true,
  };
  const coquelicot = await prisma.product.upsert({
    where: { slug: "tresor-capitaine-coquelicot" },
    create: {
      slug: "tresor-capitaine-coquelicot",
      ...coquelicotData,
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: adminId,
      source: "admin",
      collections: { create: [{ collectionId: colBySlug["pirates"], position: 0 }, { collectionId: colBySlug["5-8-ans"], position: 0 }] },
    },
    // Les textes définitifs remplacent les emplacements provisoires (prix et statut conservés)
    update: { ...coquelicotData, priceCents: undefined, isFeatured: undefined },
  });
  console.log(`Produit : ${coquelicot.name} (${coquelicot.status})`);

  // --- Illustrations fournies (servies depuis /public, versionnées avec le code) --
  // Seules les images « seed » (/images/seed/…) sont gérées ici : celles ajoutées
  // depuis l'admin ne sont jamais touchées.
  const seedImages = [
    { url: "/images/seed/coquelicot-couverture.webp", role: "MAIN" as const, alt: "Le trésor de la Capitaine Coquelicot : des enfants pirates découvrent un coffre au trésor sur la plage", width: 1254, height: 1254, position: 0 },
    { url: "/images/seed/coquelicot-capitaine-plage.webp", role: "ILLUSTRATION" as const, alt: "La Capitaine Coquelicot et son perroquet devant un coffre au trésor, un bateau pirate au loin", width: 1086, height: 1448, position: 1 },
    { url: "/images/seed/coquelicot-planche-personnages.webp", role: "GALLERY" as const, alt: "Planche des personnages : la Capitaine Coquelicot, son perroquet, le bateau et la carte", width: 1536, height: 1024, position: 2 },
    { url: "/images/seed/coquelicot-capitaine-plage.webp", role: "GALLERY" as const, alt: "La Capitaine Coquelicot sur la plage au trésor", width: 1086, height: 1448, position: 3 },
  ];
  await prisma.productImage.deleteMany({ where: { productId: coquelicot.id, url: { startsWith: "/images/seed/" } } });
  await prisma.productImage.createMany({ data: seedImages.map((img) => ({ ...img, productId: coquelicot.id })) });
  await prisma.product.update({ where: { id: coquelicot.id }, data: { ogImageUrl: "/images/seed/coquelicot-couverture.webp" } });
  await prisma.category.update({ where: { slug: "chasses-au-tresor" }, data: { illustrationUrl: "/images/seed/carte-au-tresor.webp" } });

  // --- Paramètres du site (valeurs par défaut explicites) ----------------------
  await prisma.siteSetting.upsert({
    where: { key: "homepage" },
    create: { key: "homepage", value: { featuredProductIds: [coquelicot.id], hero: { imageUrl: "/images/brand/banniere-la-malle-a-jeux.webp" } } },
    update: {},
  });
  // Logo et image de partage : complétés s'ils manquent (sans écraser un choix fait dans l'admin)
  const brandRow = await prisma.siteSetting.findUnique({ where: { key: "brand" } });
  const brandValue = (brandRow?.value as Record<string, unknown> | null) ?? {};
  if (!brandValue.logoUrl) {
    await prisma.siteSetting.upsert({ where: { key: "brand" }, create: { key: "brand", value: { ...brandValue, logoUrl: "/images/brand/logo-la-malle-a-jeux.webp" } }, update: { value: { ...brandValue, logoUrl: "/images/brand/logo-la-malle-a-jeux.webp" } } });
  }
  const seoRow = await prisma.siteSetting.findUnique({ where: { key: "seo" } });
  const seoValue = (seoRow?.value as Record<string, unknown> | null) ?? {};
  if (!seoValue.ogImageUrl) {
    await prisma.siteSetting.upsert({ where: { key: "seo" }, create: { key: "seo", value: { ...seoValue, ogImageUrl: "/images/brand/banniere-la-malle-a-jeux.webp" } }, update: { value: { ...seoValue, ogImageUrl: "/images/brand/banniere-la-malle-a-jeux.webp" } } });
  }

  // --- Pages juridiques (brouillons : à valider avant mise en production) -------
  const pages = [
    { slug: "mentions-legales", title: "Mentions légales", position: 1 },
    { slug: "cgv", title: "Conditions générales de vente", position: 2 },
    { slug: "confidentialite", title: "Politique de confidentialité", position: 3 },
    { slug: "cookies", title: "Gestion des cookies", position: 4 },
    { slug: "retractation", title: "Droit de rétractation et contenus numériques", position: 5 },
    { slug: "faq", title: "Questions fréquentes", position: 6 },
    { slug: "contact", title: "Contact", position: 7 },
  ];
  for (const p of pages) {
    await prisma.staticPage.upsert({
      where: { slug: p.slug },
      create: {
        ...p,
        status: "DRAFT",
        content: `# ${p.title}\n\n[À COMPLÉTER ET VALIDER PAR UN PROFESSIONNEL] Ce texte est un emplacement. Il doit être rédigé et validé avant la mise en production.\n`,
      },
      update: {},
    });
  }

  // --- Produits d'exemple (brouillons) pour visualiser les modèles de fiche -----
  if (process.env.SEED_DEMO === "1") {
    const demos: Array<{ slug: string; name: string; template: ProductTemplate; category: string; universe: string; ageMin: number; ageMax: number; price: number }> = [
      { slug: "exemple-chasse-au-tresor-dinosaures", name: "(Exemple) Chasse au trésor des dinosaures", template: "ADVENTURE", category: "chasses-au-tresor", universe: "Dinosaures", ageMin: 4, ageMax: 7, price: 990 },
      { slug: "exemple-mission-agents-secrets", name: "(Exemple) Mission agents secrets", template: "ADVENTURE", category: "chasses-au-tresor", universe: "Espions", ageMin: 7, ageMax: 11, price: 1190 },
      { slug: "exemple-cahier-activites-3-5-ans", name: "(Exemple) Cahier d'activités 3–5 ans", template: "ACTIVITY", category: "activites-educatives", universe: "Animaux", ageMin: 3, ageMax: 5, price: 690 },
      { slug: "exemple-kit-anniversaire-espace", name: "(Exemple) Kit d'anniversaire Espace", template: "EVENT", category: "evenements", universe: "Espace", ageMin: 5, ageMax: 9, price: 1490 },
      { slug: "exemple-histoire-du-soir-foret", name: "(Exemple) Histoire du soir : la forêt enchantée", template: "STORY", category: "histoires-et-aventures", universe: "Forêt enchantée", ageMin: 3, ageMax: 6, price: 490 },
    ];
    for (const d of demos) {
      await prisma.product.upsert({
        where: { slug: d.slug },
        create: {
          slug: d.slug, name: d.name, template: d.template, categoryId: catBySlug[d.category], universe: d.universe,
          tagline: "[EXEMPLE] Sous-titre à compléter", shortDescription: "[EXEMPLE] Produit de démonstration créé par le seed pour visualiser le modèle de fiche. À supprimer ou remplacer.",
          ageMin: d.ageMin, ageMax: d.ageMax, priceCents: d.price, status: "DRAFT", badges: ["Exemple"], createdById: adminId, source: "admin",
        },
        update: {},
      });
    }
    console.log(`${demos.length} produits d'exemple créés (brouillons)`);
  }

  console.log("Seed terminé.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
