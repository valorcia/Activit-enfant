import Link from "next/link";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, AdminCard, StatusPill } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { formatDateTime } from "@/lib/utils";
import { ApiKeyManager } from "@/components/admin/ops-apikey-manager";

export const metadata = { title: "API & automatisation" };
export const dynamic = "force-dynamic";

export default async function ApiAdminPage() {
  await requirePermission("apikeys:write");
  const [keys, pending] = await Promise.all([
    prisma.apiKey.findMany({ orderBy: { createdAt: "desc" }, include: { createdBy: { select: { email: true } } } }),
    prisma.product.findMany({ where: { needsReview: true }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, slug: true, status: true, createdAt: true, source: true } }),
  ]);
  const base = `${env.appUrl}/api/v1`;
  return (
    <div className="space-y-6">
      <AdminPageHeader title="API & automatisation" description="Clés d'accès à l'API d'importation (création de produits par des outils externes ou des agents IA) et file de validation humaine." />

      <AdminCard title={`Produits en attente de validation humaine (${pending.length})`} description="Créés via l'API : ils restent en brouillon tant qu'un éditeur ne les a pas vérifiés et publiés.">
        <DataTable
          rows={pending} rowKey={(p) => p.id} empty="Aucun produit en attente."
          columns={[
            { key: "name", header: "Produit", render: (p) => <Link href={`/admin/produits/${p.id}`} className="font-bold hover:underline">{p.name}</Link> },
            { key: "status", header: "Statut", render: (p) => <StatusPill status={p.status} /> },
            { key: "source", header: "Source", render: (p) => p.source },
            { key: "date", header: "Créé", render: (p) => <span className="text-xs text-ink-soft">{formatDateTime(p.createdAt)}</span> },
            { key: "edit", header: "", render: (p) => <Link href={`/admin/produits/${p.id}`} className="text-xs font-bold text-coral-dark hover:underline">Vérifier et publier →</Link> },
          ]}
        />
      </AdminCard>

      <AdminCard title="Clés API" description="La clé complète n'est affichée qu'une seule fois à la création. Seule une empreinte (SHA-256) est conservée.">
        <ApiKeyManager keys={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null, createdBy: k.createdBy?.email ?? null }))} />
      </AdminCard>

      <AdminCard title="Documentation de l'API" description="Toutes les requêtes portent l'en-tête Authorization: Bearer <clé>. Limite : 60 requêtes par minute et par clé.">
        <div className="space-y-4 text-sm">
          <p>Base : <code className="rounded bg-ink/5 px-1.5 py-0.5">{base}</code></p>
          <table className="w-full text-left text-xs">
            <thead><tr className="text-ink-muted"><th className="py-1 pr-3">Méthode</th><th className="py-1 pr-3">Route</th><th className="py-1 pr-3">Scope</th><th className="py-1">Description</th></tr></thead>
            <tbody className="divide-y divide-line">
              {[
                ["POST", "/products", "products:write", "Crée un produit en brouillon (validation humaine requise avant publication)."],
                ["GET", "/products?page=&status=", "products:read", "Liste paginée des produits."],
                ["GET", "/products/:id", "products:read", "Détail d'un produit (sans les fichiers payants)."],
                ["PATCH", "/products/:id", "products:write", "Mise à jour partielle (descriptions, prix, SEO, catégories…)."],
                ["POST", "/products/:id/images", "products:write", "Ajoute une image : multipart (file, role, alt) ou JSON { url, role, alt }."],
                ["POST", "/products/:id/files", "products:write", "Ajoute un fichier payant (PDF) : multipart (file, kind, name) → stockage privé."],
                ["POST", "/products/:id/publish", "products:publish", "{ scheduledAt? } : programme la publication ; sans date, publie immédiatement (scope products:publish requis)."],
                ["GET", "/categories", "products:read", "Catégories (id, slug, nom)."],
                ["GET", "/collections", "products:read", "Collections (id, slug, nom)."],
              ].map(([m, r, s, d]) => <tr key={r + m}><td className="py-1.5 pr-3 font-mono font-bold">{m}</td><td className="py-1.5 pr-3 font-mono">{r}</td><td className="py-1.5 pr-3 font-mono text-ink-muted">{s}</td><td className="py-1.5">{d}</td></tr>)}
            </tbody>
          </table>
          <details className="rounded-xl bg-[#FBFAF7] p-3">
            <summary className="cursor-pointer font-bold">Exemple : créer un produit</summary>
            <pre className="mt-2 overflow-x-auto text-xs">{`curl -X POST ${base}/products \\
  -H "Authorization: Bearer cc_xxx" -H "Content-Type: application/json" \\
  -d '{
    "name": "Chasse au trésor des dinosaures",
    "tagline": "Une aventure préhistorique à imprimer",
    "shortDescription": "…", "longDescription": "…", "story": "…",
    "template": "ADVENTURE", "categorySlug": "chasses-au-tresor", "collectionSlugs": ["5-8-ans"],
    "universe": "Dinosaures", "ageMin": 5, "ageMax": 8, "durationMinutes": 60,
    "priceCents": 990, "taxRateBp": 2000,
    "kitContents": [{ "title": "Carte", "description": "…", "icon": "map" }],
    "faq": [{ "question": "…", "answer": "…" }],
    "seoTitle": "…", "seoDescription": "…", "keywords": ["chasse au trésor dinosaures"],
    "images": [{ "url": "https://…/cover.png", "role": "MAIN", "alt": "…" }]
  }'`}</pre>
          </details>
          <p className="text-xs text-ink-muted">Flux recommandé pour un agent IA : 1) POST /products (brouillon) → 2) POST /images → 3) POST /files (PDF) → 4) PATCH (SEO, prix) → 5) POST /publish avec scheduledAt ou laisser un humain publier depuis l&apos;administration. Documentation complète : <code>apps/shop/docs/API.md</code>.</p>
        </div>
      </AdminCard>
    </div>
  );
}
