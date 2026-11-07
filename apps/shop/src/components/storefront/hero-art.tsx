import { cn } from "@/lib/utils";

/**
 * Grand visuel illustré du hero : composition décorative de plusieurs univers
 * (pirates, dinosaures, espace, princesses, animaux, forêt enchantée).
 * Emplacement provisoire clairement identifié tant que l'illustration
 * définitive n'est pas fournie (admin → Apparence → image du hero).
 */
export function HeroArt({ className }: { className?: string }) {
  const universes = [
    { label: "Pirates", color: "var(--brand-sky)", x: 40, y: 60, r: 70 },
    { label: "Dinosaures", color: "var(--brand-sage)", x: 170, y: 40, r: 56 },
    { label: "Espace", color: "var(--brand-lavender)", x: 300, y: 70, r: 66 },
    { label: "Princesses", color: "var(--brand-coral)", x: 90, y: 200, r: 60 },
    { label: "Animaux", color: "var(--brand-honey)", x: 220, y: 190, r: 62 },
    { label: "Forêt enchantée", color: "var(--brand-sage)", x: 340, y: 210, r: 58 },
  ];
  return (
    <div className={cn("relative aspect-[4/3] w-full", className)} role="img" aria-label="Illustration à venir : pirates, dinosaures, espace, princesses, animaux et forêt enchantée">
      <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="hero-glow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M30 20 C 120 -20, 300 -10, 380 50 C 420 90, 400 220, 340 270 C 270 320, 90 310, 40 250 C -10 190, -20 70, 30 20 Z" fill="var(--brand-honey)" opacity="0.35" />
        <rect width="400" height="300" fill="url(#hero-glow)" />
        {/* Mer / vague pirate */}
        <path d="M-10 250 C 60 220, 120 280, 200 250 S 340 220, 410 255 L 410 310 L -10 310 Z" fill="var(--brand-sky)" opacity="0.6" />
        {/* Bateau */}
        <path d="M40 232 L 150 232 L 135 258 L 55 258 Z" fill="var(--brand-ink)" opacity="0.8" />
        <rect x="93" y="150" width="4" height="84" fill="var(--brand-ink)" opacity="0.8" />
        <path d="M97 152 L 150 200 L 97 200 Z" fill="#fff" opacity="0.95" />
        <path d="M93 160 L 50 205 L 93 205 Z" fill="var(--brand-coral)" opacity="0.9" />
        {/* Soleil / planète */}
        <circle cx="330" cy="60" r="34" fill="var(--brand-honey)" />
        <ellipse cx="330" cy="62" rx="52" ry="10" fill="none" stroke="var(--brand-lavender)" strokeWidth="5" opacity="0.9" />
        {/* Étoiles */}
        {[[250, 30], [290, 110], [370, 120], [40, 40], [200, 100]].map(([x, y], i) => (
          <path key={i} d={`M${x} ${y - 6} l 2 4 l 4 0 l -3 3 l 1 4 l -4 -2 l -4 2 l 1 -4 l -3 -3 l 4 0 z`} fill="#fff" opacity="0.9" />
        ))}
        {/* Dino */}
        <path d="M170 215 c -20 -40, 20 -70, 50 -55 c 15 8, 18 30, 10 45 l 12 10 l -18 0 l -4 -8 c -10 2, -20 2, -30 -2 l -2 10 l -14 0 z" fill="var(--brand-sage)" />
        <circle cx="213" cy="168" r="3" fill="var(--brand-ink)" />
        {/* Château */}
        <path d="M270 150 l 0 60 l 60 0 l 0 -60 l -10 0 l 0 -14 l -10 14 l -10 0 l 0 -22 l -10 22 l -10 0 l 0 -14 l -10 14 z" fill="var(--brand-lavender)" />
        <rect x="294" y="185" width="12" height="25" rx="6" fill="var(--brand-ink)" opacity="0.7" />
        {/* Arbres forêt */}
        <path d="M352 170 l 22 -40 l 22 40 z M352 195 l 22 -40 l 22 40 z" fill="var(--brand-sage)" opacity="0.95" />
        <rect x="371" y="195" width="6" height="18" fill="var(--brand-ink)" opacity="0.6" />
        {/* Renard / animal */}
        <path d="M20 200 c 8 -18, 30 -18, 38 0 l 4 18 l -46 0 z" fill="var(--brand-coral)" />
        <path d="M22 184 l 6 -14 l 8 12 z M48 184 l -6 -14 l -8 12 z" fill="var(--brand-coral)" />
        <circle cx="32" cy="196" r="2.2" fill="var(--brand-ink)" />
        <circle cx="46" cy="196" r="2.2" fill="var(--brand-ink)" />
        {/* Nuages */}
        <g fill="#fff" opacity="0.9">
          <ellipse cx="80" cy="90" rx="28" ry="12" /><ellipse cx="98" cy="82" rx="18" ry="12" />
          <ellipse cx="250" cy="70" rx="24" ry="10" /><ellipse cx="238" cy="63" rx="14" ry="10" />
        </g>
        {universes.map((u) => (
          <circle key={u.label} cx={u.x} cy={u.y} r={u.r} fill={u.color} opacity="0.12" />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <span className="rounded-full border border-dashed border-ink/30 bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft backdrop-blur">
          Illustration à venir · pirates · dinosaures · espace · princesses · animaux · forêt
        </span>
      </div>
    </div>
  );
}
