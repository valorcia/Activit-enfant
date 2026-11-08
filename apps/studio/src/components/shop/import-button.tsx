"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importShopProductAction } from "@/app/actions/shop";

export function ImportProductButton({ productId, name }: { productId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        aria-label={`Importer « ${name} » dans le studio`}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await importShopProductAction(productId);
            if (!r.ok) return setError(r.error);
            router.push(`/books/${r.bookId}?tab=shop`);
          })
        }
      >
        <Download className="h-3.5 w-3.5" /> {pending ? "Import…" : "Importer dans le studio"}
      </Button>
      {error && <span className="text-xs text-red-700 max-w-[16rem] text-right">{error}</span>}
    </div>
  );
}
