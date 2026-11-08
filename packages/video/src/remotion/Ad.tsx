import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, formatPrice, sceneTimings, type AdProps } from "../schema";
import { BODY_FONT, HEADING_FONT } from "./fonts";
import { Clip, Picture, resolveSrc } from "./media";

/**
 * Publicité La Malle à Jeux en 4 scènes :
 *  1. accroche (illustration en zoom lent ou clip IA) + titre animé
 *  2. ce que contient le kit (vignettes qui défilent)
 *  3. bénéfices (puces animées)
 *  4. offre (couverture, prix, appel à l'action, logo)
 * Zone de sécurité Reels/TikTok : aucun texte dans les 10 % du haut ni les 15 % du bas.
 */
export const Ad: React.FC<AdProps> = (props) => {
  const { fps, width, height } = useVideoConfig();
  const t = sceneTimings(props.durationSeconds, props.kitItems.length > 0);
  const portrait = height > width;
  const safe = { top: Math.round(height * 0.1), bottom: Math.round(height * 0.15), side: Math.round(width * 0.07) };
  const s = width / 1080; // échelle typographique

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.cream, fontFamily: BODY_FONT, color: BRAND.ink }}>
      <Sequence durationInFrames={t.hook} name="Accroche">
        <HookScene {...props} safe={safe} s={s} portrait={portrait} />
      </Sequence>
      {t.kit > 0 && (
        <Sequence from={t.hook} durationInFrames={t.kit} name="Contenu du kit">
          <KitScene {...props} safe={safe} s={s} portrait={portrait} />
        </Sequence>
      )}
      <Sequence from={t.hook + t.kit} durationInFrames={t.benefits} name="Bénéfices">
        <BenefitsScene {...props} safe={safe} s={s} portrait={portrait} />
      </Sequence>
      <Sequence from={t.hook + t.kit + t.benefits} durationInFrames={t.offer} name="Offre">
        <OfferScene {...props} safe={safe} s={s} portrait={portrait} />
      </Sequence>
      {props.music && <Music src={props.music} volume={props.musicVolume} total={t.total} fps={fps} />}
    </AbsoluteFill>
  );
};

type SceneProps = AdProps & { safe: { top: number; bottom: number; side: number }; s: number; portrait: boolean };

function Music({ src, volume, total, fps }: { src: string; volume: number; total: number; fps: number }) {
  const fade = Math.min(fps, Math.floor(total / 4));
  return (
    <Audio
      src={resolveSrc(src)}
      volume={(f) => interpolate(f, [0, fade, total - fade, total], [0, volume, volume, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
  );
}

function useEnter(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.8 } });
}

function Caption({ children, size, color = BRAND.ink, bg = "rgba(255,249,240,0.92)", style }: { children: React.ReactNode; size: number; color?: string; bg?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "inline-block", background: bg, color, borderRadius: size * 0.45, padding: `${size * 0.25}px ${size * 0.5}px`, fontFamily: HEADING_FONT, fontWeight: 700, fontSize: size, lineHeight: 1.12, boxShadow: "0 12px 30px rgba(41,50,65,0.18)", ...style }}>
      {children}
    </div>
  );
}

function HookScene(p: SceneProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.06, 1.2], { extrapolateRight: "clamp" });
  const pan = interpolate(frame, [0, durationInFrames], [0, -3], { extrapolateRight: "clamp" });
  const enter = useEnter(6);
  const enter2 = useEnter(16);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: p.hookClip ? undefined : `scale(${zoom}) translateY(${pan}%)` }}>
        {p.hookClip ? <Clip src={p.hookClip} /> : <Picture src={p.heroImage} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(41,50,65,0.35) 0%, rgba(41,50,65,0) 35%, rgba(41,50,65,0) 60%, rgba(41,50,65,0.45) 100%)" }} />
      <AbsoluteFill style={{ padding: `${p.safe.top}px ${p.safe.side}px ${p.safe.bottom}px`, justifyContent: "flex-end", gap: 24 * p.s }}>
        <div style={{ transform: `translateY(${(1 - enter) * 60}px)`, opacity: enter }}>
          <Caption size={(p.portrait ? 76 : 64) * p.s} bg={BRAND.coral} color="#fff">{p.hook}</Caption>
        </div>
        <div style={{ transform: `translateY(${(1 - enter2) * 60}px)`, opacity: enter2 }}>
          <Caption size={(p.portrait ? 50 : 42) * p.s}>{p.title}</Caption>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function KitScene(p: SceneProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const items = p.kitItems;
  const per = Math.max(1, Math.floor(durationInFrames / Math.max(1, items.length)));
  const title = useEnter(0);
  const cols = p.portrait ? 2 : Math.min(items.length, 3);
  return (
    <AbsoluteFill style={{ background: BRAND.sky, padding: `${p.safe.top}px ${p.safe.side}px ${p.safe.bottom}px` }}>
      <div style={{ opacity: title, transform: `translateY(${(1 - title) * 30}px)`, fontFamily: HEADING_FONT, fontWeight: 700, fontSize: 72 * p.s, color: BRAND.ink, marginBottom: 40 * p.s }}>
        Tout est dans le kit
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 28 * p.s }}>
        {items.map((it, i) => {
          const appear = spring({ frame: frame - i * Math.min(per, 12), fps: 30, config: { damping: 200 } });
          return (
            <div key={i} style={{ opacity: appear, transform: `scale(${0.85 + appear * 0.15}) rotate(${(i % 2 ? 1 : -1) * (1 - appear) * 4}deg)`, background: "#fff", borderRadius: 28 * p.s, padding: 16 * p.s, boxShadow: "0 14px 32px rgba(41,50,65,0.18)" }}>
              <div style={{ position: "relative", aspectRatio: "3 / 4", borderRadius: 18 * p.s, overflow: "hidden", background: [BRAND.honey, BRAND.sage, BRAND.lavender, BRAND.coral][i % 4], display: "grid", placeItems: "center" }}>
                {it.image ? <Picture src={it.image} /> : <span style={{ fontFamily: HEADING_FONT, fontWeight: 700, fontSize: 120 * p.s, color: "rgba(255,255,255,0.9)" }}>★</span>}
              </div>
              <div style={{ fontFamily: HEADING_FONT, fontWeight: 700, fontSize: 38 * p.s, marginTop: 12 * p.s, lineHeight: 1.1 }}>{it.title}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function BenefitsScene(p: SceneProps) {
  return (
    <AbsoluteFill style={{ background: BRAND.cream, padding: `${p.safe.top}px ${p.safe.side}px ${p.safe.bottom}px`, justifyContent: "center", gap: 36 * p.s }}>
      {p.bullets.map((b, i) => (
        <Bullet key={i} index={i} text={b} s={p.s} />
      ))}
    </AbsoluteFill>
  );
}

function Bullet({ index, text, s }: { index: number; text: string; s: number }) {
  const enter = useEnter(index * 10);
  const colors = [BRAND.coral, BRAND.sage, BRAND.honey];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 * s, opacity: enter, transform: `translateX(${(1 - enter) * -80}px)` }}>
      <div style={{ flex: "0 0 auto", width: 96 * s, height: 96 * s, borderRadius: "50%", background: colors[index % 3], color: "#fff", display: "grid", placeItems: "center", fontFamily: HEADING_FONT, fontWeight: 700, fontSize: 56 * s }}>✓</div>
      <div style={{ fontFamily: HEADING_FONT, fontWeight: 700, fontSize: 64 * s, lineHeight: 1.12 }}>{text}</div>
    </div>
  );
}

function OfferScene(p: SceneProps) {
  const frame = useCurrentFrame();
  const enter = useEnter(0);
  const cta = useEnter(14);
  const pulse = 1 + Math.sin(frame / 6) * 0.025;
  return (
    <AbsoluteFill style={{ background: BRAND.coral, padding: `${p.safe.top}px ${p.safe.side}px ${p.safe.bottom}px`, alignItems: "center", justifyContent: "center", gap: 34 * p.s, textAlign: "center" }}>
      <div style={{ width: (p.portrait ? 620 : 420) * p.s, aspectRatio: "1 / 1", borderRadius: 36 * p.s, overflow: "hidden", boxShadow: "0 24px 60px rgba(41,50,65,0.35)", transform: `rotate(${(1 - enter) * -6}deg) scale(${0.9 + enter * 0.1})`, opacity: enter }}>
        <Picture src={p.coverImage ?? p.heroImage} />
      </div>
      <div style={{ color: "#fff", fontFamily: HEADING_FONT, fontWeight: 700, fontSize: 56 * p.s, lineHeight: 1.1 }}>{p.title}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 22 * p.s, color: "#fff", fontFamily: HEADING_FONT, fontWeight: 700 }}>
        <span style={{ fontSize: 96 * p.s }}>{formatPrice(p.priceCents, p.currency)}</span>
        {p.compareAtCents != null && <span style={{ fontSize: 48 * p.s, textDecoration: "line-through", opacity: 0.75 }}>{formatPrice(p.compareAtCents, p.currency)}</span>}
      </div>
      <div style={{ transform: `scale(${cta * pulse})`, opacity: cta }}>
        <Caption size={58 * p.s} bg={BRAND.honey}>{p.cta}</Caption>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 * p.s, color: "#fff", fontSize: 36 * p.s, fontWeight: 800 }}>
        {p.logo && <div style={{ height: 70 * p.s, background: "#fff", borderRadius: 14 * p.s, padding: 8 * p.s }}><Picture src={p.logo} style={{ height: "100%", width: "auto", objectFit: "contain" }} /></div>}
        <span>{p.url || p.brandName}</span>
      </div>
    </AbsoluteFill>
  );
}
