/** Libellés des gabarits éditoriaux, par langue. */
import type { EditorialLang } from "./typography";

const EN_NUMBERS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];
const FR_NUMBERS = ["premier", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf", "vingt"];
const FR_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface Labels {
  contents: string;
  chapter: (n: number) => string;
  activity: string;
  memory: string;
  writtenFor: string;
  photo: string;
  dear: string;
  epilogue: string;
  imprint: string;
  colophon: (o: { recipient?: string; date: string; edition?: string }) => string;
  date: (d: Date) => string;
}

export const LABELS: Record<EditorialLang, Labels> = {
  en: {
    contents: "Contents",
    chapter: (n) => `Chapter ${EN_NUMBERS[n - 1] ?? n}`,
    activity: "Your turn",
    memory: "To keep",
    writtenFor: "Written for",
    photo: "A photograph",
    dear: "Dear",
    epilogue: "Afterword",
    imprint: "UNWRITTEN",
    colophon: ({ recipient, date, edition }) =>
      [
        edition ? `Personal edition no. ${edition}` : "Personal edition",
        recipient ? `composed for ${recipient} on ${date}.` : `composed on ${date}.`,
        "Set in Fraunces and Newsreader, typefaces released under the SIL Open Font License.",
        "© UNWRITTEN. All rights reserved. This book was written for one reader only.",
      ].join("\n"),
    date: (d) => `${d.getUTCDate()} ${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  },
  fr: {
    contents: "Sommaire",
    chapter: (n) => `Chapitre ${FR_NUMBERS[n - 1] ?? n}`,
    activity: "À vous",
    memory: "À garder",
    writtenFor: "Écrit pour",
    photo: "Une photographie",
    dear: "Cher",
    epilogue: "Pour finir",
    imprint: "UNWRITTEN",
    colophon: ({ recipient, date, edition }) =>
      [
        edition ? `Édition personnelle n° ${edition},` : "Édition personnelle,",
        recipient ? `composée pour ${recipient} le ${date}.` : `composée le ${date}.`,
        "Composé en Fraunces et Newsreader, caractères diffusés sous licence SIL Open Font License.",
        "© UNWRITTEN. Tous droits réservés. Ce livre a été écrit pour un seul lecteur.",
      ].join("\n"),
    date: (d) => `${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${FR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  },
};
