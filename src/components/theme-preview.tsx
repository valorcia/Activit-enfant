import type { BookTheme } from "@/lib/schemas/layout";

export function ThemePreview({ theme }: { theme: BookTheme }) {
  return (
    <div className="aspect-[210/297] w-full rounded-md border border-slate-200 overflow-hidden relative" style={{ background: theme.colorBackground }}>
      <div style={{ background: theme.colorPrimary, height: "18%" }} />
      <div className="absolute left-[8%] top-[6%] text-white font-black" style={{ fontFamily: theme.fontHeading, fontSize: 14 }}>Titre</div>
      <div className="absolute left-[8%] top-[24%] w-[40%] rounded" style={{ background: theme.colorPanel, height: "22%" }} />
      <div className="absolute right-[8%] top-[24%] w-[36%] rounded" style={{ background: theme.colorSecondary, height: "22%", opacity: 0.8 }} />
      <div className="absolute left-[8%] top-[52%] w-[84%] space-y-1">
        {[1, 2, 3].map((i) => <div key={i} className="h-[4px] rounded" style={{ background: theme.colorText, opacity: 0.25, width: `${90 - i * 12}%` }} />)}
      </div>
      <div className="absolute left-[8%] bottom-[8%] w-[84%] rounded" style={{ background: theme.colorAccent, height: "10%", opacity: 0.7 }} />
    </div>
  );
}
