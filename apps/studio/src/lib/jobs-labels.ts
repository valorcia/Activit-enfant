export function labelFor(type: string) {
  return (
    {
      "book.pipeline": "Production du livre",
      "book.outline": "Sommaire",
      "activity.generate": "Rédaction de la fiche",
      "activity.illustrate": "Illustrations de l'activité",
      "illustration.single": "Illustration",
      "book.layout": "Mise en page",
      "book.export": "Export PDF",
      "book.cover": "Couverture",
      "shop.publish": "Publication boutique",
      "ad.clip": "Clip d'accroche (vidéo pub)",
      "ad.render": "Montage vidéo pub",
    }[type] ?? type
  );
}
