import { AlertTriangle } from "lucide-react";

/**
 * Sur Vercel, le disque est temporaire et distinct de celui du worker : sans stockage S3/R2,
 * les images produites par le worker sont introuvables (aperçus vides, PDF sans images).
 */
export function StorageBanner() {
  if (!process.env.VERCEL) return null;
  const missing = process.env.STORAGE_DRIVER !== "s3"
    ? ["STORAGE_DRIVER=s3"]
    : ["S3_BUCKET", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter((k) => !process.env[k]);
  if (!missing.length) return null;
  return (
    <div role="alert" className="border-b border-red-300 bg-red-50 px-6 py-3 text-sm text-red-900">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Stockage des images non configuré sur ce studio en ligne</p>
      <p className="mt-1">
        Les images et PDF fabriqués par le worker sont rangés dans Cloudflare R2, mais ce studio ne sait pas les lire : les aperçus restent vides.
        Ajoutez dans Vercel (projet du studio → Settings → Environment Variables) : <strong>{missing.join(", ")}</strong>, avec les mêmes valeurs que le worker, puis « Redeploy ».
      </p>
    </div>
  );
}
