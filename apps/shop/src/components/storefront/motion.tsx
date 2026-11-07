"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

/**
 * Apparition discrète au défilement. Le HTML rendu côté serveur reste visible
 * (pas d'opacité 0 avant hydratation) ; l'animation n'est activée qu'après
 * montage et jamais si l'utilisateur préfère réduire les animations.
 */
export function Reveal({ children, delay = 0, className, as = "div", ...rest }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" | "article" } & Omit<HTMLMotionProps<"div">, "children">) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const Comp = (motion as unknown as Record<string, typeof motion.div>)[as] ?? motion.div;
  if (reduce || !mounted) return <Comp className={className}>{children}</Comp>;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Flottement très léger pour les éléments décoratifs. */
export function Float({ children, className, amplitude = 8, duration = 6, delay = 0 }: { children: React.ReactNode; className?: string; amplitude?: number; duration?: number; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} animate={{ y: [0, -amplitude, 0] }} transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}>
      {children}
    </motion.div>
  );
}
