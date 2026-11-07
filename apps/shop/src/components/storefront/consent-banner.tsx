"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readConsent, writeConsent } from "@/lib/analytics/client";

export function ConsentBanner({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    setVisible(!readConsent());
    const onOpen = () => { setVisible(true); setCustom(true); };
    window.addEventListener("cc-consent-open", onOpen);
    return () => window.removeEventListener("cc-consent-open", onOpen);
  }, [enabled]);

  if (!visible) return null;
  const save = (a: boolean, m: boolean) => { writeConsent({ analytics: a, marketing: m }); setVisible(false); };

  return (
    <div role="dialog" aria-live="polite" aria-label="Gestion des cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-3xl border border-line bg-white p-5 shadow-lift sm:inset-x-auto sm:right-5">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-honey-light text-honey-dark"><Cookie className="size-5" /></span>
        <div className="text-sm">
          <p className="font-heading text-base font-bold">Des cookies, mais pas en chocolat</p>
          <p className="mt-1 text-ink-soft">Nous utilisons des cookies de mesure d&apos;audience et de publicité pour améliorer le site. Les cookies nécessaires au panier et au paiement sont toujours actifs. <Link href="/pages/cookies" className="underline">En savoir plus</Link></p>
        </div>
      </div>
      {custom && (
        <div className="mt-4 space-y-2 rounded-2xl bg-cream p-3 text-sm">
          <label className="flex items-center justify-between"><span>Mesure d&apos;audience</span><input type="checkbox" className="size-4 accent-coral" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /></label>
          <label className="flex items-center justify-between"><span>Publicité personnalisée</span><input type="checkbox" className="size-4 accent-coral" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /></label>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => save(true, true)}>Tout accepter</Button>
        <Button size="sm" variant="outline" onClick={() => save(false, false)}>Refuser</Button>
        {custom ? <Button size="sm" variant="ghost" onClick={() => save(analytics, marketing)}>Enregistrer mes choix</Button> : <Button size="sm" variant="ghost" onClick={() => setCustom(true)}>Personnaliser</Button>}
      </div>
    </div>
  );
}
