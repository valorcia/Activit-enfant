"use client";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { Block, BookTheme, TextStyle } from "@/lib/schemas/layout";

const FONTS = ["Nunito", "Fredoka", "Baloo 2", "Georgia", "Arial"];

export function Inspector({ block, theme, onChange, onDelete, onOrder }: { block: Block | null; theme: BookTheme; onChange: (patch: Partial<Block>) => void; onDelete: () => void; onOrder: (dir: -1 | 1) => void }) {
  if (!block) return <section><div className="font-bold text-xs uppercase text-slate-500 mb-1">Bloc</div><p className="text-xs text-slate-500">Cliquez sur un élément de la page pour le modifier. Double-cliquez un texte pour l'éditer. Glissez pour déplacer, poignée en bas à droite pour redimensionner.</p></section>;
  const style = ((block as { style?: TextStyle }).style ?? {}) as TextStyle;
  const setStyle = (patch: Partial<TextStyle>) => onChange({ style: { ...style, ...patch } } as Partial<Block>);
  const num = (k: "x" | "y" | "w" | "h") => (
    <label className="flex flex-col text-[11px]">{k.toUpperCase()} (mm)<Input type="number" step="0.5" className="h-7 text-xs" value={block[k]} onChange={(e) => onChange({ [k]: Number(e.target.value) } as Partial<Block>)} /></label>
  );
  return (
    <section className="space-y-3">
      <div className="font-bold text-xs uppercase text-slate-500">Bloc · {block.type}{"role" in block ? ` (${block.role})` : ""}</div>
      <div className="grid grid-cols-4 gap-1">{num("x")}{num("y")}{num("w")}{num("h")}</div>
      {(block.type === "text" || block.type === "list" || block.type === "step" || block.type === "toc") && (
        <>
          <label className="flex flex-col text-[11px]">Taille (pt)<Input type="number" step="0.5" className="h-7 text-xs" value={style.fontSizePt ?? theme.baseFontPt} onChange={(e) => setStyle({ fontSizePt: Number(e.target.value) })} /></label>
          <label className="flex flex-col text-[11px]">Police<Select className="h-7 text-xs" value={style.fontFamily ?? ""} onChange={(e) => setStyle({ fontFamily: e.target.value || undefined })}><option value="">(thème)</option>{FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</Select></label>
          <div className="grid grid-cols-2 gap-1">
            <label className="flex flex-col text-[11px]">Couleur<Input type="color" className="h-7 p-0.5" value={style.color ?? theme.colorText} onChange={(e) => setStyle({ color: e.target.value })} /></label>
            <label className="flex flex-col text-[11px]">Fond<Input type="color" className="h-7 p-0.5" value={style.background ?? "#ffffff"} onChange={(e) => setStyle({ background: e.target.value })} /></label>
          </div>
          {block.type === "text" && (
            <div className="grid grid-cols-2 gap-1">
              <label className="flex flex-col text-[11px]">Alignement<Select className="h-7 text-xs" value={style.align ?? "left"} onChange={(e) => setStyle({ align: e.target.value as TextStyle["align"] })}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option><option value="justify">Justifié</option></Select></label>
              <label className="flex flex-col text-[11px]">Graisse<Select className="h-7 text-xs" value={style.weight ?? "normal"} onChange={(e) => setStyle({ weight: e.target.value as TextStyle["weight"] })}><option value="normal">Normale</option><option value="bold">Gras</option></Select></label>
              <label className="flex flex-col text-[11px]">Interligne<Input type="number" step="0.05" className="h-7 text-xs" value={style.lineHeight ?? 1.45} onChange={(e) => setStyle({ lineHeight: Number(e.target.value) })} /></label>
              <label className="flex flex-col text-[11px]">Marge int. (mm)<Input type="number" step="0.5" className="h-7 text-xs" value={style.padding ?? 0} onChange={(e) => setStyle({ padding: Number(e.target.value) })} /></label>
            </div>
          )}
          {block.type === "text" && <label className="flex flex-col text-[11px]">Texte<textarea className="rounded border border-slate-300 p-1 text-xs min-h-[80px]" value={block.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)} /></label>}
          {block.type === "list" && <label className="flex flex-col text-[11px]">Éléments (un par ligne)<textarea className="rounded border border-slate-300 p-1 text-xs min-h-[80px]" value={block.items.join("\n")} onChange={(e) => onChange({ items: e.target.value.split("\n") } as Partial<Block>)} /></label>}
          {block.type === "step" && (
            <>
              <label className="flex flex-col text-[11px]">Titre<Input className="h-7 text-xs" value={block.title} onChange={(e) => onChange({ title: e.target.value } as Partial<Block>)} /></label>
              <label className="flex flex-col text-[11px]">Instruction<textarea className="rounded border border-slate-300 p-1 text-xs min-h-[80px]" value={block.instruction} onChange={(e) => onChange({ instruction: e.target.value } as Partial<Block>)} /></label>
              <label className="flex flex-col text-[11px]">Astuce<Input className="h-7 text-xs" value={block.tip} onChange={(e) => onChange({ tip: e.target.value } as Partial<Block>)} /></label>
            </>
          )}
        </>
      )}
      {block.type === "image" && (
        <>
          <label className="flex flex-col text-[11px]">Ajustement<Select className="h-7 text-xs" value={block.fit} onChange={(e) => onChange({ fit: e.target.value as "contain" | "cover" } as Partial<Block>)}><option value="contain">Contenir (sans déformation)</option><option value="cover">Remplir (recadrage)</option></Select></label>
          <label className="flex flex-col text-[11px]">URL de l'image<Input className="h-7 text-xs" value={block.src ?? ""} onChange={(e) => onChange({ src: e.target.value || undefined } as Partial<Block>)} /></label>
          <label className="flex flex-col text-[11px]">Légende<Input className="h-7 text-xs" value={block.caption} onChange={(e) => onChange({ caption: e.target.value } as Partial<Block>)} /></label>
          <label className="flex flex-col text-[11px]">Arrondi (mm)<Input type="number" className="h-7 text-xs" value={style.radius ?? 0} onChange={(e) => setStyle({ radius: Number(e.target.value) })} /></label>
          {block.isDemo && <p className="text-[11px] text-red-700">Image de démonstration : à remplacer par une illustration réelle (page de l'activité).</p>}
        </>
      )}
      {block.type === "shape" && (
        <div className="grid grid-cols-2 gap-1">
          <label className="flex flex-col text-[11px]">Couleur<Input type="color" className="h-7 p-0.5" value={block.color} onChange={(e) => onChange({ color: e.target.value } as Partial<Block>)} /></label>
          <label className="flex flex-col text-[11px]">Bordure<Input type="color" className="h-7 p-0.5" value={style.borderColor ?? "#ffffff"} onChange={(e) => setStyle({ borderColor: e.target.value })} /></label>
          <label className="flex flex-col text-[11px]">Arrondi (mm)<Input type="number" className="h-7 text-xs" value={style.radius ?? 0} onChange={(e) => setStyle({ radius: Number(e.target.value) })} /></label>
        </div>
      )}
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" onClick={() => onOrder(-1)} title="Arrière-plan">↓ Plan</Button>
        <Button size="sm" variant="secondary" onClick={() => onOrder(1)} title="Premier plan">↑ Plan</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>Supprimer</Button>
      </div>
    </section>
  );
}
