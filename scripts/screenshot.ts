import "dotenv/config";
import { chromium } from "playwright-core";
const [url, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: "networkidle" });
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
})();
