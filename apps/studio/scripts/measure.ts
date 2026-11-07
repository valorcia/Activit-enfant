import "dotenv/config";
import { chromium } from "playwright-core";
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ deviceScaleFactor: 2, viewport: { width: 1200, height: 1600 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/print/books/cmvezkvxw00047dla9mwox4m9", { waitUntil: "networkidle" });
  const r = await p.evaluate(() => {
    const out: unknown[] = [];
    document.querySelectorAll<HTMLElement>("[data-block-id]").forEach((el) => {
      const inner = el.querySelector<HTMLElement>("[data-measure]") ?? el;
      if (inner.scrollHeight > el.clientHeight + 1) out.push({ id: el.dataset.blockId, type: el.dataset.blockType, sh: inner.scrollHeight, ch: el.clientHeight, ih: inner.clientHeight, box: getComputedStyle(inner).boxSizing, text: inner.innerText.slice(0, 40) });
    });
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
