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

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangezMoi123!";
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD doit être défini en production");
  }

  // --- Administrateur ------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: "Administrateur", passwordHash: await bcrypt.hash(adminPassword, 12), role: "ADMIN" },
    update: {},
  });
  console.log(`Administrateur : ${admin.email}`);

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
    { slug: "8-12-ans", name: "8–12 ans", description: "Défis et missions pour les grands explorateurs.", color: "#C8B6E8", position: 4 },
  ];
  const colBySlug: Record<string, string> = {};
  for (const c of collections) {
    const row = await prisma.collection.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name, description: c.description, color: c.color, position: c.position } });
    colBySlug[c.slug] = row.id;
  }

  // --- Premier produit : Le trésor de la Capitaine Coquelicot -----------------
  const coquelicot = await prisma.product.upsert({
    where: { slug: "tresor-capitaine-coquelicot" },
    create: {
      slug: "tresor-capitaine-coquelicot",
      name: "Le trésor de la Capitaine Coquelicot",
      tagline: "Une chasse au trésor de pirates à imprimer, prête en quelques minutes",
      shortDescription: "Kit numérique de chasse au trésor sur le thème des pirates, pour les enfants de 5 à 8 ans. À télécharger et imprimer à la maison.",
      longDescription:
        "[À COMPLÉTER] Description longue du kit : déroulé de la chasse, préparation, conseils d'organisation.\n\nCe texte est un emplacement provisoire : il sera remplacé par la description définitive validée.",
      story:
        "La Capitaine Coquelicot a besoin de votre aide ! Son trésor a disparu et seuls de courageux petits pirates pourront retrouver les indices cachés.\n\n[À COMPLÉTER] Suite de l'histoire et présentation immersive de l'aventure.",
      template: "ADVENTURE" as ProductTemplate,
      categoryId: catBySlug["chasses-au-tresor"],
      universe: "Pirates",
      tags: ["pirates", "chasse au trésor", "énigmes", "anniversaire"],
      badges: ["Nouveau"],
      heroBadges: ["PDF immédiat", "Facile à organiser", "Prêt à imprimer", "5–8 ans"],
      ageMin: 5,
      ageMax: 8,
      fileFormat: "PDF",
      priceCents: 990, // [À CONFIRMER] prix provisoire
      currency: "EUR",
      taxRateBp: 2000,
      kitContents: [
        { title: "Carte au trésor", description: "[À COMPLÉTER] Description de la carte.", icon: "map", quantity: 1 },
        { title: "Énigmes", description: "[À COMPLÉTER] Nombre et nature des énigmes.", icon: "puzzle" },
        { title: "Invitations", description: "[À COMPLÉTER]", icon: "mail" },
        { title: "Diplômes de pirate", description: "[À COMPLÉTER]", icon: "award" },
        { title: "Instructions d'organisation", description: "[À COMPLÉTER]", icon: "list-checks" },
        { title: "Accessoires à imprimer", description: "[À COMPLÉTER]", icon: "scissors" },
      ],
      sellingPoints: [
        { title: "Simple à organiser", description: "Tout est prêt : il suffit d'imprimer, de cacher les indices et de lancer l'aventure.", icon: "list-checks" },
        { title: "Une activité originale", description: "Une histoire de pirates immersive, pensée pour captiver les enfants de 5 à 8 ans.", icon: "sparkles" },
        { title: "Des moments partagés", description: "Une aventure à vivre ensemble, en famille ou entre amis.", icon: "heart" },
        { title: "Impression à domicile", description: "Format PDF, compatible avec toutes les imprimantes.", icon: "printer" },
        { title: "Téléchargement immédiat", description: "Vos fichiers sont disponibles dès la confirmation du paiement.", icon: "download" },
      ],
      faq: [
        { question: "Comment recevoir mon kit ?", answer: "Dès la validation du paiement, vous recevez un email avec vos liens de téléchargement. Vous pouvez aussi retrouver vos achats à tout moment depuis la page « Retrouver mes achats »." },
        { question: "Quel matériel faut-il prévoir ?", answer: "[À COMPLÉTER] Matériel nécessaire (imprimante, ciseaux, etc.)." },
        { question: "Combien de temps dure la chasse au trésor ?", answer: "[À COMPLÉTER] Durée indicative." },
      ],
      seoTitle: "Chasse au trésor pirates à imprimer — Capitaine Coquelicot",
      seoDescription: "Kit de chasse au trésor pirates à imprimer pour enfants de 5 à 8 ans : carte, énigmes, invitations et diplômes. Téléchargement immédiat.",
      keywords: ["chasse au trésor pirate", "chasse au trésor à imprimer", "anniversaire pirate", "jeu enfant 5 ans"],
      status: "PUBLISHED",
      publishedAt: new Date(),
      isFeatured: true,
      createdById: admin.id,
      source: "admin",
      collections: { create: [{ collectionId: colBySlug["pirates"], position: 0 }, { collectionId: colBySlug["5-8-ans"], position: 0 }] },
    },
    update: {},
  });
  console.log(`Produit : ${coquelicot.name} (${coquelicot.status})`);

  // --- Paramètres du site (valeurs par défaut explicites) ----------------------
  await prisma.siteSetting.upsert({
    where: { key: "homepage" },
    create: { key: "homepage", value: { featuredProductIds: [coquelicot.id] } },
    update: {},
  });

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
          ageMin: d.ageMin, ageMax: d.ageMax, priceCents: d.price, status: "DRAFT", badges: ["Exemple"], createdById: admin.id, source: "admin",
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
