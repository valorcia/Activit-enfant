import { chromium, type Browser } from "playwright-core";
import { existsSync } from "node:fs";

let browserPromise: Promise<Browser> | null = null;

function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p));
}

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = chromiumPath();
    browserPromise = chromium
      .launch({ headless: true, executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"] })
      .catch((err) => {
        browserPromise = null;
        throw new Error(`Impossible de lancer Chromium (${executablePath ?? "non trouvé"}) : ${err instanceof Error ? err.message : err}`);
      });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close();
  }
}
