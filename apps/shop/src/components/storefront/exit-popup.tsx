"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import type { ConversionSettings } from "@/lib/schemas/settings";

const STORAGE_KEY = "cc-exit-popup-seen";

/**
 * Popup de sortie : affichée une seule fois par visiteur, après un délai ou à
 * l'intention de quitter la page (souris vers le haut, desktop). Désactivable
 * depuis Admin → Apparence → Conversion.
 */
export function ExitPopup({ config }: { config: ConversionSettings["exitPopup"] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const show = useCallback(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch { /* stockage indisponible : on affiche quand même une fois */ }
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!config.enabled) return;
    try { if (localStorage.getItem(STORAGE_KEY)) return; } catch { /* ignoré */ }
    // Jamais sur les pages de paiement / commande
    if (/^\/(panier|commande|mes-achats|admin)/.test(window.location.pathname)) return;
    const timer = window.setTimeout(show, config.delaySeconds * 1000);
    const onLeave = (e: MouseEvent) => { if (e.clientY <= 0 && e.relatedTarget === null) show(); };
    document.addEventListener("mouseout", onLeave);
    return () => { window.clearTimeout(timer); document.removeEventListener("mouseout", onLeave); };
  }, [config.enabled, config.delaySeconds, show]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  if (!config.enabled || !open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="exit-popup-title">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-lift">
        <div className="bg-honey px-6 py-5">
          <span className="grid size-11 place-items-center rounded-2xl bg-white text-honey-dark shadow-sm"><Gift className="size-6" /></span>
          <h2 id="exit-popup-title" className="mt-3 font-heading text-2xl font-bold leading-tight text-ink">{config.title}</h2>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/80 text-ink hover:bg-white"><X className="size-5" /></button>
        <div className="space-y-4 p-6">
          <p className="text-sm text-ink-soft">{config.text}</p>
          {config.couponCode && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-coral bg-coral-light px-4 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-coral-dark">Votre code promo</p>
                <p className="font-heading text-xl font-bold tracking-wider">{config.couponCode}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(config.couponCode ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignoré */ } }}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copié" : "Copier"}
              </Button>
            </div>
          )}
          <NewsletterForm source="exit-popup" compact />
          <button type="button" onClick={() => setOpen(false)} className="w-full text-center text-xs font-semibold text-ink-muted underline-offset-4 hover:underline">Non merci, je continue ma visite</button>
        </div>
      </div>
    </div>
  );
}
