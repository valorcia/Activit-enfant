"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { duplicateActivity } from "@/app/actions/activities";
import { addLibraryActivityToBook } from "@/app/actions/books";

export function LibraryRowActions({ activityId, books }: { activityId: string; books: { id: string; title: string }[] }) {
  const [pending, start] = useTransition();
  const [bookId, setBookId] = useState("");
  return (
    <div className="flex items-center gap-1 justify-end">
      {books.length > 0 && (
        <>
          <Select className="h-8 w-40 text-xs" value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">Ajouter au livre…</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </Select>
          <Button size="sm" variant="secondary" disabled={!bookId || pending} onClick={() => start(async () => { await addLibraryActivityToBook(bookId, activityId); setBookId(""); })}>OK</Button>
        </>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await duplicateActivity(activityId); })}>Dupliquer</Button>
    </div>
  );
}
