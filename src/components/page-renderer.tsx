"use client";
import * as React from "react";
import type { Block, BookTheme, PageLayout } from "@/lib/schemas/layout";
import { cn } from "@/lib/utils";

export interface PageRendererProps {
  layout: PageLayout;
  theme: BookTheme;
  pageNumber?: number;
  pageIndex?: number;
  mode?: "print" | "preview" | "edit";
  scale?: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onBlockPointerDown?: (e: React.PointerEvent, block: Block, handle: "move" | "resize") => void;
  onTextCommit?: (id: string, text: string) => void;
  className?: string;
}

const HEADING_ROLES = new Set(["title", "subtitle", "heading", "label"]);

export function PageRenderer({ layout, theme, pageNumber, pageIndex, mode = "preview", scale = 1, selectedId, onSelect, onBlockPointerDown, onTextCommit, className }: PageRendererProps) {
  const style: React.CSSProperties = {
    width: `${layout.widthMm}mm`,
    height: `${layout.heightMm}mm`,
    background: layout.background ?? theme.colorBackground,
    color: theme.colorText,
    fontFamily: `"${theme.fontBody}", "Nunito", sans-serif`,
    fontSize: `${theme.baseFontPt}pt`,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: "top left",
  };
  return (
    <div className={cn("book-page", className)} style={style} data-page-index={pageIndex} onPointerDown={mode === "edit" ? () => onSelect?.(null) : undefined}>
      {layout.blocks.map((b) => (
        <BlockView key={b.id} block={b} theme={theme} mode={mode} selected={selectedId === b.id} onSelect={onSelect} onBlockPointerDown={onBlockPointerDown} onTextCommit={onTextCommit} />
      ))}
      {layout.showPageNumber && pageNumber !== undefined && (
        <div style={{ position: "absolute", bottom: "6mm", left: 0, right: 0, textAlign: "center", fontSize: "9pt", color: "#6b7280" }}>{pageNumber}</div>
      )}
    </div>
  );
}

function BlockView({ block, theme, mode, selected, onSelect, onBlockPointerDown, onTextCommit }: { block: Block; theme: BookTheme; mode: "print" | "preview" | "edit"; selected: boolean; onSelect?: (id: string | null) => void; onBlockPointerDown?: PageRendererProps["onBlockPointerDown"]; onTextCommit?: (id: string, text: string) => void }) {
  const s = (block as { style?: Record<string, unknown> }).style ?? {};
  const base: React.CSSProperties = {
    left: `${block.x}mm`,
    top: `${block.y}mm`,
    width: `${block.w}mm`,
    height: `${block.h}mm`,
    cursor: mode === "edit" ? "move" : undefined,
  };
  const editable = mode === "edit";
  const handlers = editable
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          e.stopPropagation();
          onSelect?.(block.id);
          if (!(e.target as HTMLElement).isContentEditable) onBlockPointerDown?.(e, block, "move");
        },
      }
    : {};
  const cls = cn(editable && "editor-hover", selected && "editor-selected");
  const wrap = (children: React.ReactNode, extra?: React.CSSProperties) => (
    <div data-block-id={block.id} data-block-type={block.type} className={cls} style={{ ...base, ...extra }} {...handlers}>
      {children}
      {selected && editable && <div className="resize-handle" onPointerDown={(e) => { e.stopPropagation(); onBlockPointerDown?.(e, block, "resize"); }} />}
    </div>
  );

  switch (block.type) {
    case "shape": {
      const borderColor = s.borderColor as string | undefined;
      return wrap(null, { background: block.color, borderRadius: block.shape === "circle" ? "50%" : `${(s.radius as number) ?? 0}mm`, border: borderColor ? `0.6mm solid ${borderColor}` : undefined });
    }
    case "text": {
      const heading = HEADING_ROLES.has(block.role);
      const fontFamily = (s.fontFamily as string) ?? (heading ? theme.fontHeading : theme.fontBody);
      const style: React.CSSProperties = {
        fontSize: `${(s.fontSizePt as number) ?? theme.baseFontPt}pt`,
        fontFamily: `"${fontFamily}", "Nunito", sans-serif`,
        color: (s.color as string) ?? (block.role === "title" || block.role === "heading" ? theme.colorPrimary : theme.colorText),
        background: s.background as string | undefined,
        textAlign: (s.align as React.CSSProperties["textAlign"]) ?? "left",
        fontWeight: s.weight === "bold" || heading ? 700 : 400,
        lineHeight: (s.lineHeight as number) ?? (heading ? 1.15 : 1.45),
        padding: s.padding ? `${s.padding}mm` : undefined,
        borderRadius: s.radius ? `${s.radius}mm` : undefined,
        border: s.borderColor ? `0.4mm solid ${s.borderColor}` : undefined,
        overflow: "hidden",
        height: "100%",
        outline: "none",
      };
      return wrap(
        <div
          data-measure
          style={style}
          contentEditable={editable && block.editable}
          suppressContentEditableWarning
          onBlur={editable ? (e) => onTextCommit?.(block.id, (e.currentTarget as HTMLElement).innerText) : undefined}
        >
          {block.text.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>,
      );
    }
    case "list": {
      const fontSize = `${(s.fontSizePt as number) ?? theme.baseFontPt}pt`;
      const titleColor = block.role === "warnings" ? "#c2410c" : theme.colorPrimary;
      return wrap(
        <div data-measure style={{ fontSize, background: s.background as string, padding: s.padding ? `${s.padding}mm` : undefined, borderRadius: s.radius ? `${s.radius}mm` : undefined, border: s.borderColor ? `0.4mm solid ${s.borderColor}` : undefined, height: "100%", overflow: "hidden" }}>
          {block.title && (
            <div style={{ fontFamily: `"${theme.fontHeading}", sans-serif`, fontWeight: 700, color: titleColor, fontSize: "1.15em", marginBottom: "1.5mm" }}>
              {block.role === "warnings" ? "⚠ " : ""}
              {block.title}
            </div>
          )}
          {block.role === "keywords" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5mm" }}>
              {block.items.map((it, i) => (
                <span key={i} style={{ background: theme.colorAccent, color: "#fff", borderRadius: "3mm", padding: "0.5mm 2.5mm", fontWeight: 700, fontSize: "0.9em" }}>
                  {it}
                </span>
              ))}
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {block.items.map((it, i) => (
                <li key={i} style={{ display: "flex", gap: "2mm", lineHeight: 1.35, marginBottom: "1mm" }}>
                  <span style={{ flex: "0 0 auto", color: block.role === "materials" ? theme.colorSecondary : block.role === "warnings" ? "#c2410c" : theme.colorPrimary }}>{block.role === "materials" ? "☐" : "•"}</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          )}
        </div>,
      );
    }
    case "step": {
      const fontSize = `${(s.fontSizePt as number) ?? theme.baseFontPt}pt`;
      const hasImg = Boolean(block.imageSrc);
      return wrap(
        <div data-measure style={{ display: "flex", gap: "5mm", height: "100%", fontSize, overflow: "hidden" }}>
          <div style={{ flex: "0 0 10mm", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
            <div style={{ width: "9mm", height: "9mm", borderRadius: "50%", background: theme.colorPrimary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontFamily: `"${theme.fontHeading}", sans-serif`, fontSize: "1.3em" }}>{block.number}</div>
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontFamily: `"${theme.fontHeading}", sans-serif`, fontWeight: 700, fontSize: "1.2em", color: theme.colorPrimary, marginBottom: "1.2mm" }}>
              {block.title}
              {block.adultHelp && <span title="Aide d'un adulte" style={{ marginLeft: "2mm", fontSize: "0.8em", background: "#fff7ed", color: "#c2410c", borderRadius: "2mm", padding: "0.3mm 1.5mm", fontWeight: 700 }}>avec un adulte</span>}
            </div>
            <p style={{ lineHeight: 1.45 }}>{block.instruction}</p>
            {block.tip && <p style={{ marginTop: "1.5mm", fontStyle: "italic", color: "#4b5563" }}>Astuce : {block.tip}</p>}
          </div>
          {hasImg && (
            <div style={{ flex: "0 0 52mm", height: "52mm", position: "relative", borderRadius: "3mm", overflow: "hidden", background: theme.colorPanel }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.imageSrc} alt={block.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {block.isDemo && <DemoRibbon />}
            </div>
          )}
        </div>,
      );
    }
    case "image": {
      return wrap(
        <div data-measure style={{ position: "relative", width: "100%", height: "100%", borderRadius: s.radius ? `${s.radius}mm` : undefined, overflow: "hidden", background: (s.background as string) ?? theme.colorPanel }}>
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.src} alt={block.alt} style={{ width: "100%", height: "100%", objectFit: block.fit, display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "0.5mm dashed #cbd5e1", borderRadius: "inherit", color: "#64748b", fontSize: "9pt", textAlign: "center", padding: "4mm" }}>Illustration à générer</div>
          )}
          {block.isDemo && <DemoRibbon />}
          {block.caption && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,0.85)", fontSize: "8pt", padding: "1mm 2mm", textAlign: "center" }}>{block.caption}</div>}
        </div>,
      );
    }
    case "badges": {
      return wrap(
        <div data-measure style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2mm", height: "100%" }}>
          {block.items.map((it, i) => (
            <div key={i} style={{ background: theme.colorPanel, borderRadius: "2.5mm", padding: "1.5mm 3mm", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
              <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", fontWeight: 700 }}>{it.label}</div>
              <div style={{ fontSize: "10pt", fontWeight: 700, color: theme.colorText }}>{it.value}</div>
            </div>
          ))}
        </div>,
      );
    }
    case "toc": {
      const fontSize = `${(s.fontSizePt as number) ?? 12}pt`;
      return wrap(
        <div data-measure style={{ fontSize, height: "100%", overflow: "hidden" }}>
          {block.entries.map((e) => (
            <div key={e.number} style={{ display: "flex", alignItems: "baseline", gap: "2mm", height: "8.2mm" }}>
              <span style={{ flex: "0 0 9mm", fontWeight: 900, color: theme.colorSecondary, fontFamily: `"${theme.fontHeading}", sans-serif` }}>{e.number}</span>
              <span style={{ flex: "0 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
              <span style={{ flex: "1 1 auto", borderBottom: "0.3mm dotted #94a3b8", transform: "translateY(-1mm)" }} />
              <span style={{ flex: "0 0 auto", fontWeight: 700 }}>{e.page}</span>
            </div>
          ))}
        </div>,
      );
    }
    default:
      return null;
  }
}

function DemoRibbon() {
  return (
    <div style={{ position: "absolute", top: "2mm", left: "-10mm", transform: "rotate(-30deg)", background: "#dc2626", color: "#fff", fontSize: "7pt", fontWeight: 900, padding: "0.8mm 12mm", letterSpacing: "0.05em", boxShadow: "0 0 2mm rgba(0,0,0,0.3)" }}>DÉMO</div>
  );
}
