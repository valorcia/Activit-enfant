import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import type { StorageDriver } from "./index";

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint,
      forcePathStyle: !!env.s3.endpoint,
      credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
    });
  }
  return client;
}

/** Stockage S3 compatible (AWS, Cloudflare R2, Scaleway, MinIO…). Le bucket doit être privé. */
export function s3StorageDriver(): StorageDriver {
  const Bucket = env.s3.bucket;
  return {
    async put(Key, Body, ContentType) {
      await s3().send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
    },
    async get(Key) {
      try {
        const res = await s3().send(new GetObjectCommand({ Bucket, Key }));
        const bytes = await res.Body?.transformToByteArray();
        if (!bytes) return null;
        return { body: Buffer.from(bytes), contentType: res.ContentType ?? "application/octet-stream" };
      } catch {
        return null;
      }
    },
    async delete(Key) {
      await s3().send(new DeleteObjectCommand({ Bucket, Key }));
    },
    async exists(Key) {
      try { await s3().send(new HeadObjectCommand({ Bucket, Key })); return true; } catch { return false; }
    },
    async signedUrl(Key, { expiresInSeconds, fileName }) {
      return getSignedUrl(
        s3(),
        new GetObjectCommand({
          Bucket,
          Key,
          ResponseContentDisposition: fileName ? `attachment; filename="${fileName}"` : undefined,
        }),
        { expiresIn: expiresInSeconds },
      );
    },
    publicUrl(key) {
      if (env.s3.publicBaseUrl) return `${env.s3.publicBaseUrl}/${key}`;
      return `/api/media/${key.replace(/^public\//, "")}`;
    },
  };
}
