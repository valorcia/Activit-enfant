import { Baby, BookOpen, Brush, Cake, Dice5, Egg, FlaskConical, Ghost, Gift, Leaf, Lightbulb, Map, Moon, Palette, PencilRuler, Puzzle, Scissors, Search, Shapes, Sparkles, TreePine, UserRoundPen, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { map: Map, search: Search, cake: Cake, egg: Egg, ghost: Ghost, gift: Gift, "tree-pine": TreePine, "pencil-ruler": PencilRuler, puzzle: Puzzle, shapes: Shapes, "book-open": BookOpen, moon: Moon, "user-round-pen": UserRoundPen, lightbulb: Lightbulb, "flask-conical": FlaskConical, scissors: Scissors, palette: Palette, leaf: Leaf, "dice-5": Dice5, baby: Baby, brush: Brush };

export function KitIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Sparkles;
  return <I className={className} aria-hidden />;
}
