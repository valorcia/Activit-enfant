"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pushPublicKeyAction, removePushSubscriptionAction, savePushSubscriptionAction, testPushAction } from "@/app/actions/admin/push";

type Support = "checking" | "ok" | "unsupported" | "ios-install" | "denied";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Appareil";
  const nav = /CriOS|Chrome/.test(ua) && !/Edg/.test(ua) ? "Chrome" : /Edg/.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Navigateur";
  const installed = window.matchMedia("(display-mode: standalone)").matches ? " (application)" : "";
  return `${os} · ${nav}${installed}`;
}

async function registration() {
  return navigator.serviceWorker.register("/push-sw.js", { scope: "/admin" });
}

/** Activation des notifications de commande sur l'appareil courant. */
export function PushSettings() {
  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    // Détection de l'appareil (navigateur seulement), appliquée de façon asynchrone
    const detect = async (): Promise<{ support: Support; subscribed: boolean }> => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return { support: ios && !standalone ? "ios-install" : "unsupported", subscribed: false };
      if (Notification.permission === "denied") return { support: "denied", subscribed: false };
      const sub = await registration().then((reg) => reg.pushManager.getSubscription()).catch(() => null);
      return { support: "ok", subscribed: !!sub };
    };
    let alive = true;
    detect().then((r) => { if (!alive) return; setSupport(r.support); setSubscribed(r.subscribed); });
    return () => { alive = false; };
  }, []);

  const enable = () => start(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport(permission === "denied" ? "denied" : "ok");
        toast.error("Autorisation refusée : les notifications ne peuvent pas être activées.");
        return;
      }
      const key = await pushPublicKeyAction();
      if (!key.ok) { toast.error(key.error); return; }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key.key) }));
      const r = await savePushSubscriptionAction(sub.toJSON(), deviceLabel());
      if (r.ok) { setSubscribed(true); toast.success(r.message ?? "Activé"); } else toast.error(r.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activation impossible");
    }
  });

  const disable = () => start(async () => {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removePushSubscriptionAction({ endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setSubscribed(false);
    toast.success("Notifications désactivées sur cet appareil");
  });

  const test = () => start(async () => { const r = await testPushAction(); if (r.ok) toast.success(r.message); else toast.error(r.error); });

  if (support === "checking") return <p className="text-sm text-ink-muted">Vérification de l&apos;appareil…</p>;
  if (support === "ios-install") {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-bold">Sur iPhone, installez d&apos;abord l&apos;application :</p>
        <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
          <li>Ouvrez cette page dans <strong>Safari</strong> (iOS 16.4 ou plus récent).</li>
          <li>Touchez le bouton <strong>Partager</strong>, puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>.</li>
          <li>Ouvrez l&apos;application <strong>Boutique</strong> depuis l&apos;écran d&apos;accueil, revenez sur cette page et activez les notifications.</li>
        </ol>
      </div>
    );
  }
  if (support === "unsupported") return <p className="text-sm text-ink-soft">Ce navigateur ne permet pas les notifications. Sur Android, utilisez Chrome ; sur iPhone, Safari après « Sur l&apos;écran d&apos;accueil ».</p>;
  if (support === "denied") return <p className="text-sm text-ink-soft">Les notifications sont bloquées pour ce site dans les réglages du navigateur ou du téléphone. Autorisez-les, puis rechargez cette page.</p>;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {subscribed ? (
        <>
          <span className="rounded-full bg-sage-light px-3 py-1 text-sm font-bold text-sage-dark">Activées sur cet appareil</span>
          <Button size="sm" variant="outline" disabled={pending} onClick={test}>Envoyer une notification d&apos;essai</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={disable}>Désactiver ici</Button>
        </>
      ) : (
        <Button size="sm" disabled={pending} onClick={enable}>Activer les notifications sur cet appareil</Button>
      )}
    </div>
  );
}
