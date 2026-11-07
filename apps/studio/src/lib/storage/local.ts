import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageDriver } from "./index";

export class LocalStorage implements StorageDriver {
  constructor(private root: string) {}
  private resolve(key: string) {
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    return path.join(path.resolve(this.root), safe);
  }
  async put(key: string, data: Buffer) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }
  async get(key: string) {
    return fs.readFile(this.resolve(key));
  }
  async exists(key: string) {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
  publicUrl() {
    return null;
  }
}
