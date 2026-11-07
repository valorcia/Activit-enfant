"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/admin/data-table";
import { FormField } from "@/components/admin/form-controls";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Alert } from "@/components/ui/misc";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/actions/admin/apikeys";
import { API_SCOPES } from "@/lib/api/auth";
import { formatDateTime } from "@/lib/utils";

interface KeyView { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; createdBy: string | null }

const SCOPE_LABELS: Record<string, string> = { "products:read": "Lecture du catalogue", "products:write": "Création / modification (brouillons)", "products:publish": "Publication directe (sans validation humaine)" };

export function ApiKeyManager({ keys }: { keys: KeyView[] }) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [scopes, setScopes] = useState<string[]>(["products:read", "products:write"]);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("name");
    start(async () => {
      const r = await createApiKeyAction({ name, scopes });
      if (r.ok) setSecret(r.secret); else toast.error(r.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end"><Button variant="admin" size="sm" onClick={() => { setSecret(null); setOpen(true); }}><Plus className="size-4" /> Nouvelle clé</Button></div>
      <DataTable
        rows={keys} rowKey={(k) => k.id} empty="Aucune clé API."
        columns={[
          { key: "name", header: "Nom", render: (k) => <span className="font-bold">{k.name}</span> },
          { key: "prefix", header: "Préfixe", render: (k) => <code className="text-xs">{k.prefix}…</code> },
          { key: "scopes", header: "Scopes", render: (k) => <span className="text-xs">{k.scopes.join(", ")}</span> },
          { key: "used", header: "Dernier usage", render: (k) => <span className="text-xs text-ink-soft">{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "jamais"}</span> },
          { key: "status", header: "Statut", render: (k) => k.revokedAt ? <span className="text-xs text-red-700 font-bold">révoquée</span> : <span className="text-xs font-bold text-sage-dark">active</span> },
          { key: "actions", header: "", className: "text-right", render: (k) => !k.revokedAt ? <ConfirmButton variant="ghost" size="sm" className="text-red-700" title={`Révoquer « ${k.name} » ?`} description="Les intégrations utilisant cette clé cesseront de fonctionner immédiatement." confirmLabel="Révoquer" successMessage="Clé révoquée" onConfirm={() => revokeApiKeyAction(k.id)}>Révoquer</ConfirmButton> : null },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{secret ? "Clé créée" : "Nouvelle clé API"}</DialogTitle><DialogDescription>{secret ? "Copiez cette clé maintenant : elle ne sera plus jamais affichée." : "Nommez la clé et choisissez ses permissions."}</DialogDescription></DialogHeader>
          {secret ? (
            <div className="space-y-3">
              <div className="flex gap-2"><Input readOnly value={secret} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} /><Button type="button" variant="outline" size="icon" aria-label="Copier" onClick={() => { navigator.clipboard.writeText(secret); toast.success("Clé copiée"); }}><Copy className="size-4" /></Button></div>
              <Alert variant="warning">Conservez-la dans un gestionnaire de secrets. En cas de perte, révoquez-la et créez-en une nouvelle.</Alert>
              <div className="flex justify-end"><Button variant="admin" onClick={() => setOpen(false)}>Terminé</Button></div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <FormField label="Nom" htmlFor="k-name" required><Input id="k-name" name="name" placeholder="Agent de création IA, Zapier…" required /></FormField>
              <fieldset className="space-y-2">
                <legend className="text-sm font-bold">Permissions</legend>
                {API_SCOPES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-coral" checked={scopes.includes(s)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} /> <span><code className="text-xs">{s}</code> — {SCOPE_LABELS[s]}</span></label>
                ))}
              </fieldset>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" variant="admin" disabled={pending || scopes.length === 0}>{pending ? "…" : "Créer la clé"}</Button></div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
