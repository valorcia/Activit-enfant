import { CSV_COLUMNS } from "@/lib/schemas/product";

export const dynamic = "force-dynamic";

const EXAMPLE: Record<string, string> = {
  name: "Chasse au trésor des dinosaures", slug: "chasse-au-tresor-dinosaures", category: "chasses-au-tresor", collections: "5-8-ans|dinosaures", template: "ADVENTURE",
  tagline: "Une aventure préhistorique à imprimer", short_description: "Kit de chasse au trésor sur le thème des dinosaures.", long_description: "Description longue (markdown accepté).", story: "Il était une fois…",
  universe: "Dinosaures", tags: "dinosaures,chasse au trésor", badges: "Nouveau", age_min: "4", age_max: "7", players_min: "2", players_max: "8", duration_minutes: "60", difficulty: "2", page_count: "24", materials: "imprimante,ciseaux",
  price: "9.90", sale_price: "", sale_starts_at: "", sale_ends_at: "", tax_rate: "20", seo_title: "Chasse au trésor dinosaures à imprimer", seo_description: "Kit complet à télécharger.", keywords: "chasse au trésor dinosaure",
  main_image_url: "https://exemple.fr/image-principale.jpg", gallery_urls: "https://exemple.fr/page-1.jpg|https://exemple.fr/page-2.jpg", status: "DRAFT", scheduled_at: "",
};

function csvCell(v: string): string {
  return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Modèle CSV d'importation : entête + une ligne d'exemple. */
export function GET() {
  const lines = [CSV_COLUMNS.join(","), CSV_COLUMNS.map((c) => csvCell(EXAMPLE[c] ?? "")).join(",")];
  return new Response("﻿" + lines.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="modele-import-produits.csv"' },
  });
}
