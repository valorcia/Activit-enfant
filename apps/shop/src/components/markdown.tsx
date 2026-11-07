import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { cn } from "@/lib/utils";

marked.setOptions({ gfm: true, breaks: true });

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ["h1", "h2", "h3", "h4", "p", "br", "strong", "em", "b", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "img", "table", "thead", "tbody", "tr", "th", "td", "span", "div", "figure", "figcaption"],
  allowedAttributes: { a: ["href", "title", "target", "rel"], img: ["src", "alt", "title", "width", "height", "loading"], "*": ["class"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener" }) },
};

export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  const html = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(html, SANITIZE);
}

/** Rendu de contenu markdown (descriptions, histoires, articles, pages). */
export function Markdown({ content, className }: { content: string | null | undefined; className?: string }) {
  if (!content) return null;
  return <div className={cn("prose-brand", className)} dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
}
