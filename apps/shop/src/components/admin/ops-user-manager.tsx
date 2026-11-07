"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/admin/data-table";
import { FormField } from "@/components/admin/form-controls";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteUserAction, saveUserAction } from "@/app/actions/admin/users";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/utils";
import type { Role } from "@prisma/client";

interface UserView { id: string; email: string; name: string | null; role: Role; isActive: boolean; lastLoginAt: string | null; createdAt: string }

export function UserManager({ users, meId }: { users: UserView[]; meId: string }) {
  const [editing, setEditing] = useState<Partial<UserView> | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = { email: fd.get("email"), name: fd.get("name"), role: fd.get("role"), isActive: fd.get("isActive") === "on", password: fd.get("password") };
    start(async () => {
      const r = await saveUserAction(editing?.id ?? null, payload);
      if (r.ok) { toast.success("Utilisateur enregistré"); setEditing(null); setFields({}); } else { setFields(r.fields ?? {}); toast.error(r.error); }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end"><Button variant="admin" size="sm" onClick={() => { setEditing({ role: "EDITOR", isActive: true }); setFields({}); }}><Plus className="size-4" /> Nouvel utilisateur</Button></div>
      <DataTable
        rows={users} rowKey={(u) => u.id}
        columns={[
          { key: "email", header: "Email", render: (u) => <button className="font-bold hover:underline" onClick={() => { setEditing(u); setFields({}); }}>{u.email}</button> },
          { key: "name", header: "Nom", render: (u) => u.name ?? "—" },
          { key: "role", header: "Rôle", render: (u) => ROLE_LABELS[u.role] },
          { key: "active", header: "Actif", render: (u) => <span className={u.isActive ? "font-bold text-sage-dark" : "text-red-700"}>{u.isActive ? "Oui" : "Non"}</span> },
          { key: "login", header: "Dernière connexion", render: (u) => <span className="text-xs text-ink-soft">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "jamais"}</span> },
          { key: "actions", header: "", className: "text-right", render: (u) => u.id !== meId ? <ConfirmButton variant="ghost" size="sm" className="text-red-700" title={`Supprimer ${u.email} ?`} confirmLabel="Supprimer" successMessage="Utilisateur supprimé" onConfirm={() => deleteUserAction(u.id)}>Supprimer</ConfirmButton> : <span className="text-xs text-ink-muted">vous</span> },
        ]}
      />
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={submit} className="grid gap-4">
              <FormField label="Email" htmlFor="u-email" error={fields.email} required><Input id="u-email" name="email" type="email" defaultValue={editing.email ?? ""} required /></FormField>
              <FormField label="Nom" htmlFor="u-name"><Input id="u-name" name="name" defaultValue={editing.name ?? ""} /></FormField>
              <FormField label="Rôle" htmlFor="u-role"><NativeSelect id="u-role" name="role" defaultValue={editing.role ?? "EDITOR"}>{(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</NativeSelect></FormField>
              <FormField label={editing.id ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe"} htmlFor="u-pass" error={fields.password} hint="10 caractères minimum"><Input id="u-pass" name="password" type="password" autoComplete="new-password" minLength={editing.id ? undefined : 10} /></FormField>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isActive" defaultChecked={editing.isActive ?? true} className="size-4 accent-coral" /> Compte actif</label>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Annuler</Button><Button type="submit" variant="admin" disabled={pending}>{pending ? "…" : "Enregistrer"}</Button></div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
