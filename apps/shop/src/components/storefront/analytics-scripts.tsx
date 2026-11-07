"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
import { readConsent, type ConsentState } from "@/lib/analytics/client";
import type { AnalyticsSettings } from "@/lib/schemas/settings";

/** Charge GA4, Google Ads, Meta Pixel et Pinterest uniquement après consentement. */
export function AnalyticsScripts({ analytics }: { analytics: AnalyticsSettings }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  useEffect(() => {
    const refresh = () => setConsent(readConsent());
    refresh();
    window.addEventListener("cc-consent-change", refresh);
    return () => window.removeEventListener("cc-consent-change", refresh);
  }, []);

  const ga = analytics.gaMeasurementId || process.env.NEXT_PUBLIC_GA_ID;
  const ads = analytics.googleAdsId || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const meta = analytics.metaPixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const pin = analytics.pinterestTagId || process.env.NEXT_PUBLIC_PINTEREST_TAG_ID;
  const gtagId = ga || ads;
  if (!consent) return null;

  return (
    <>
      {consent.analytics && gtagId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('consent', 'default', { ad_storage: '${consent.marketing ? "granted" : "denied"}', analytics_storage: 'granted', ad_user_data: '${consent.marketing ? "granted" : "denied"}', ad_personalization: '${consent.marketing ? "granted" : "denied"}' });
            ${ga ? `gtag('config', '${ga}', { anonymize_ip: true });` : ""}
            ${ads && consent.marketing ? `gtag('config', '${ads}');` : ""}
          `}</Script>
        </>
      )}
      {consent.marketing && meta && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${meta}'); fbq('track', 'PageView');
        `}</Script>
      )}
      {consent.marketing && pin && (
        <Script id="pinterest-tag" strategy="afterInteractive">{`
          !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
          pintrk('load', '${pin}'); pintrk('page');
        `}</Script>
      )}
    </>
  );
}
