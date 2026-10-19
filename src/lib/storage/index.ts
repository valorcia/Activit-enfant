import { createHash } from "node:crypto";
import { prisma } from "../db";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

export interface StorageDriver {
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** URL publique directe si disponible (CDN), sinon null : on sert via /api/assets */
  publicUrl(key: string): string | null;
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  driver = process.env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage(process.env.STORAGE_LOCAL_DIR ?? "./storage");
  return driver;
}

export async function storeAsset(opts: {
  key: string;
  data: Buffer;
  mime: string;
  width?: number;
  height?: number;
}) {
  const storage = getStorage();
  await storage.put(opts.key, opts.data, opts.mime);
  const sha256 = createHash("sha256").update(opts.data).digest("hex");
  return prisma.asset.upsert({
    where: { key: opts.key },
    create: { key: opts.key, mime: opts.mime, bytes: opts.data.length, width: opts.width, height: opts.height, sha256 },
    update: { mime: opts.mime, bytes: opts.data.length, width: opts.width, height: opts.height, sha256 },
  });
}

export function assetUrl(assetId: string | null | undefined) {
  return assetId ? `/api/assets/${assetId}` : undefined;
}
