"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureUtmFromLocation } from "@/lib/analytics/utm";

/** Capture les paramètres UTM au premier atterrissage (attribution des ventes aux campagnes). */
export function UtmCapture() {
  const pathname = usePathname();
  useEffect(() => { captureUtmFromLocation(); }, [pathname]);
  return null;
}
