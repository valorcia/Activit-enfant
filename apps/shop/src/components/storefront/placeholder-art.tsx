import { cn } from "@/lib/utils";

const PALETTES: Record<string, [string, string, string]> = {
  pirates: ["#A9D8F5", "#FFD66B", "#FF826F"],
  dinosaures: ["#A8C9A1", "#FFD66B", "#C8B6E8"],
  espace: ["#C8B6E8", "#A9D8F5", "#FFD66B"],
  princesses: ["#C8B6E8", "#FF826F", "#FFD66B"],
  animaux: ["#FFD66B", "#A8C9A1", "#FF826F"],
  default: ["#FFD66B", "#A9D8F5", "#FF826F"],
};

function paletteFor(universe?: string | null): [string, string, string] {
  const key = (universe ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const k of Object.keys(PALETTES)) if (key.includes(k)) return PALETTES[k];
  return PALETTES.default;
}

/**
 * Emplacement visuel clairement identifié, utilisé tant que les illustrations
 * définitives ne sont pas fournies. Décoratif (formes organiques) + libellé.
 */
export function PlaceholderArt({ universe, label = "Illustration à venir", className, hideLabel = false }: { universe?: string | null; label?: string; className?: string; hideLabel?: boolean }) {
  const [a, b, c] = paletteFor(universe);
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)} role="img" aria-label={`${label}${universe ? ` — ${universe}` : ""}`}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <rect width="400" height="300" fill="#FFF4E6" />
        <circle cx="330" cy="60" r="90" fill={a} opacity="0.75" />
        <path d="M-20 240 C 80 180, 160 300, 260 230 S 420 200, 440 260 L 440 320 L -20 320 Z" fill={b} opacity="0.8" />
        <path d="M60 110 c 30 -60, 110 -50, 120 10 c 10 60, -70 90, -110 50 c -25 -25, -30 -40, -10 -60 z" fill={c} opacity="0.75" />
        <circle cx="90" cy="60" r="14" fill="#fff" opacity="0.7" />
        <circle cx="120" cy="40" r="8" fill="#fff" opacity="0.6" />
        <path d="M300 180 l 12 24 l 26 4 l -19 18 l 5 26 l -24 -13 l -24 13 l 5 -26 l -19 -18 l 26 -4 z" fill="#fff" opacity="0.85" />
      </svg>
      {!hideLabel && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-3">
          <span className="rounded-full border border-dashed border-ink/30 bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            {label}{universe ? ` · ${universe}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
