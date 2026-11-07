"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Bouton demandant confirmation avant une action destructive (server action). */
export function ConfirmButton({ title = "Confirmer l'action", description, confirmLabel = "Confirmer", onConfirm, successMessage, children, ...btn }: { title?: string; description?: string; confirmLabel?: string; onConfirm: () => Promise<{ ok: boolean; error?: string } | void>; successMessage?: string; children: React.ReactNode } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button {...btn} onClick={() => setOpen(true)}>{children}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Annuler</Button>
            <Button variant="danger" disabled={pending} onClick={() => start(async () => {
              const res = await onConfirm();
              if (res && !res.ok) { toast.error(res.error ?? "Erreur"); return; }
              if (successMessage) toast.success(successMessage);
              setOpen(false);
            })}>{pending ? "…" : confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
