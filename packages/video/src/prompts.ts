/**
 * Prompts de mouvement pour l'animation IA d'une illustration (image → vidéo).
 * Rédigés en anglais (mieux compris par Runway / Veo / Sora), courts, centrés sur
 * le mouvement : l'image de départ porte déjà le style et le contenu.
 */

export interface AnimationPromptInput {
  /** Ce que montre l'illustration (français ou anglais). */
  description: string;
  /** Univers : pirates, dinosaures, espace, noël… */
  universe?: string;
  /** Mouvement souhaité du personnage, sinon déduit de l'univers. */
  characterAction?: string;
  camera?: "slow-push-in" | "gentle-pan" | "static" | "orbit";
  durationSeconds?: 5 | 10;
}

const UNIVERSE_MOTION: Record<string, string> = {
  pirates: "the waves roll gently, the sails flutter in the breeze, the parrot flaps its wings and the gold coins glint",
  dinosaures: "leaves sway, the little dinosaur blinks and wiggles its tail, dust motes drift in warm sunlight",
  espace: "stars twinkle, the robot's antenna blinks, the rocket's flame flickers softly",
  noel: "snowflakes fall slowly, fairy lights twinkle, the elf peeks out with a mischievous smile",
  princesses: "petals float down, the castle flags wave, sparkles shimmer around the characters",
  animaux: "grass ripples in the wind, the animals blink and turn their heads playfully",
  foret: "light rays move through the trees, fireflies drift, leaves rustle gently",
};

const CAMERA: Record<NonNullable<AnimationPromptInput["camera"]>, string> = {
  "slow-push-in": "Slow, smooth camera push-in",
  "gentle-pan": "Gentle horizontal camera pan",
  static: "Locked-off camera",
  orbit: "Very slight orbiting camera move",
};

function normalizeUniverse(u?: string): string | undefined {
  if (!u) return undefined;
  const key = u.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return Object.keys(UNIVERSE_MOTION).find((k) => key.includes(k) || k.includes(key));
}

export function buildAnimationPrompt(input: AnimationPromptInput): string {
  const universe = normalizeUniverse(input.universe);
  const ambient = universe ? UNIVERSE_MOTION[universe] : "the scene comes gently to life with subtle ambient motion";
  const action = input.characterAction ?? "the main character smiles, blinks and makes a small friendly gesture";
  const camera = CAMERA[input.camera ?? "slow-push-in"];
  const duration = input.durationSeconds ?? 5;
  return [
    `${camera} on a children's book watercolor illustration: ${input.description.trim()}.`,
    `${capitalize(action)}; ${ambient}.`,
    "Keep the exact watercolor style, colors, characters and composition of the source image. Soft, slow, cheerful motion, family-friendly.",
    `No text, no letters, no logos, no new characters, no morphing faces. ${duration} seconds, seamless and calm.`,
  ].join(" ");
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Exemple de référence : couverture du « Trésor de la Capitaine Coquelicot ». */
export const COQUELICOT_EXAMPLE = buildAnimationPrompt({
  description: "a red-haired pirate captain with a poppy on her hat and a green parrot, children cheering around an open treasure chest full of gold on a tropical beach",
  universe: "pirates",
  characterAction: "the captain laughs and raises her hand, the children cheer and the treasure chest glows",
});
