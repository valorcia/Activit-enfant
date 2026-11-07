"use client";
import { useState } from "react";
import { Link2, MessageCircle, Check } from "lucide-react";
import { toast } from "sonner";

function withUtm(url: string, source: string) {
  const u = new URL(url);
  u.searchParams.set("utm_source", source);
  u.searchParams.set("utm_medium", "social");
  u.searchParams.set("utm_campaign", "partage-produit");
  return u.toString();
}

export function ShareButtons({ url, title, imageUrl }: { url: string; title: string; imageUrl?: string | null }) {
  const [copied, setCopied] = useState(false);
  const links = [
    { label: "Facebook", icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withUtm(url, "facebook"))}` },
    { label: "Pinterest", icon: PinterestIcon, href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(withUtm(url, "pinterest"))}&description=${encodeURIComponent(title)}${imageUrl ? `&media=${encodeURIComponent(imageUrl)}` : ""}` },
    { label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${title} ${withUtm(url, "whatsapp")}`)}` },
  ];
  async function copy() {
    try {
      await navigator.clipboard.writeText(withUtm(url, "copie"));
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier le lien");
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-bold text-ink-soft">Partager :</span>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`Partager sur ${l.label}`} className="grid size-9 place-items-center rounded-full bg-white shadow-card transition-colors hover:bg-ink hover:text-white"><l.icon className="size-4" /></a>
      ))}
      <button type="button" onClick={copy} aria-label="Copier le lien" className="grid size-9 place-items-center rounded-full bg-white shadow-card transition-colors hover:bg-ink hover:text-white">{copied ? <Check className="size-4" /> : <Link2 className="size-4" />}</button>
    </div>
  );
}

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.31-.09-.79-.17-2 .03-2.86.18-.78 1.17-4.97 1.17-4.97s-.3-.6-.3-1.48c0-1.39.8-2.42 1.81-2.42.85 0 1.26.64 1.26 1.41 0 .86-.55 2.14-.83 3.33-.24 1 .5 1.81 1.48 1.81 1.78 0 3.14-1.87 3.14-4.58 0-2.39-1.72-4.07-4.18-4.07-2.85 0-4.52 2.14-4.52 4.34 0 .86.33 1.78.74 2.28.08.1.09.19.07.29-.08.32-.25 1-.28 1.14-.04.19-.15.23-.34.14-1.25-.58-2.03-2.41-2.03-3.88 0-3.16 2.3-6.06 6.62-6.06 3.48 0 6.18 2.48 6.18 5.79 0 3.45-2.18 6.23-5.2 6.23-1.02 0-1.97-.53-2.3-1.15l-.62 2.38c-.23.87-.84 1.96-1.25 2.63.94.29 1.94.45 2.98.45 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.7v8h3.3z" />
    </svg>
  );
}
