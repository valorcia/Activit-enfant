"use client";
import { useEffect } from "react";

/** Signale au moteur de rendu PDF que toutes les images et polices sont chargées. */
export function PrintReady() {
  useEffect(() => {
    const w = window as unknown as { __INVENTOR_READY__?: boolean };
    const imgs = Array.from(document.images);
    Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      ...imgs.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); }))),
    ]).then(() => {
      w.__INVENTOR_READY__ = true;
    });
  }, []);
  return null;
}
