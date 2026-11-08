-- Studio multi-univers : univers de la boutique ciblé par chaque e-book
ALTER TABLE "Book" ADD COLUMN "siteSlug" TEXT;
ALTER TABLE "Book" ADD COLUMN "shopPublicUrl" TEXT;
