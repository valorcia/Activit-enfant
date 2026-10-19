"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { jobAction } from "@/app/actions/books";

export function JobActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1 justify-end">
      {status === "RUNNING" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => jobAction(id, "pause"))}>Pause</Button>}
      {status === "PAUSED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => jobAction(id, "resume"))}>Reprendre</Button>}
      {["QUEUED", "RUNNING", "PAUSED"].includes(status) && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => jobAction(id, "cancel"))}>Annuler</Button>}
      {status === "FAILED" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => jobAction(id, "retry"))}>Relancer</Button>}
    </div>
  );
}
