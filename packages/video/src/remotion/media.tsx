import React from "react";
import { Img, OffthreadVideo, staticFile } from "remotion";

/** Accepte une URL (http/https/data:) ou un fichier du dossier public de rendu. */
export function resolveSrc(src: string): string {
  return /^(https?:|data:|blob:)/.test(src) ? src : staticFile(src.replace(/^\/+/, ""));
}

export function Picture({ src, style }: { src: string; style?: React.CSSProperties }) {
  return <Img src={resolveSrc(src)} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />;
}

export function Clip({ src, style }: { src: string; style?: React.CSSProperties }) {
  return <OffthreadVideo src={resolveSrc(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />;
}
