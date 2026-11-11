-- Livres à grand volume : brouillon de rédaction par lots
ALTER TABLE "Book" ADD COLUMN "kitDraft" JSONB;

-- Copier-coller « en lot » des cahiers de coloriage (planches de 4 ou 9 dessins)
ALTER TYPE "ManualRequestKind" ADD VALUE IF NOT EXISTS 'IMAGE_BATCH';
