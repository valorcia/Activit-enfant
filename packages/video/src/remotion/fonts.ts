import { loadFont as loadFredoka } from "@remotion/google-fonts/Fredoka";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";

/** Polices de la marque, chargées une fois pour toutes les compositions. */
const fredoka = loadFredoka("normal", { weights: ["600", "700"], subsets: ["latin", "latin-ext"] });
const nunito = loadNunito("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });

export const HEADING_FONT = `${fredoka.fontFamily}, "Nunito", system-ui, sans-serif`;
export const BODY_FONT = `${nunito.fontFamily}, system-ui, sans-serif`;
