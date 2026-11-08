/**
 * CLI des vidéos publicitaires.
 *
 *   pnpm --filter @malle/video ad render --product <slug> --shop <url> --format story|square|landscape --out pub.mp4 [--clip clip.mp4] [--music musique.mp3] [--duration 15] [--hook "…"]
 *   pnpm --filter @malle/video ad animate --image <url|fichier> --prompt "…" [--universe pirates] --provider runway|manual --format story --duration 5 --out clip.mp4
 *   pnpm --filter @malle/video ad prompt --description "…" [--universe pirates]
 *   pnpm --filter @malle/video ad publish --product <id|slug> --file pub.mp4 --shop <url> [--format story] [--title "…"]
 *
 * Variables : SHOP_API_KEY (clé API de la boutique), RUNWAY_API_KEY (animation IA), CHROMIUM_PATH (facultatif).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { adPropsFromProduct } from "./product";
import { buildAnimationPrompt } from "./prompts";
import { createVideoProvider, ManualVideoRequiredError, waitForVideo, type VideoProviderName, type VideoRatio } from "./providers";
import { renderAd } from "./render";
import { adFormatSchema, type AdFormat } from "./schema";
import { fetchShopProduct, publishVideoToShop } from "./shop";

function parseArgs(argv: string[]): { cmd: string; flags: Record<string, string> } {
  const [cmd = "help", ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = "true";
    }
  }
  return { cmd, flags };
}

function need(flags: Record<string, string>, key: string): string {
  const v = flags[key];
  if (!v) throw new Error(`Option --${key} obligatoire`);
  return v;
}

const RATIO: Record<AdFormat, VideoRatio> = { story: "portrait", square: "square", landscape: "landscape" };

/** Copie un fichier local dans un dossier public temporaire pour le rendu Remotion. */
function stageLocal(file: string | undefined, publicDir: string): string | undefined {
  if (!file) return undefined;
  if (/^(https?:|data:)/.test(file)) return file;
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`Fichier introuvable : ${file}`);
  const name = `${Date.now()}-${path.basename(abs)}`;
  fs.copyFileSync(abs, path.join(publicDir, name));
  return name;
}

async function download(url: string, out: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2));

  if (cmd === "render") {
    const shop = need(flags, "shop");
    const format = adFormatSchema.parse(flags.format ?? "story");
    const product = await fetchShopProduct(shop, need(flags, "product"));
    const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "malle-video-"));
    const props = adPropsFromProduct(product, shop, { format, durationSeconds: flags.duration ? Number(flags.duration) : undefined, hook: flags.hook });
    props.hookClip = stageLocal(flags.clip, publicDir);
    props.music = stageLocal(flags.music, publicDir);
    const out = flags.out ?? `${product.slug}-${format}.mp4`;
    let last = -1;
    await renderAd(props, {
      format,
      outPath: out,
      publicDir,
      onProgress: (p) => {
        const pct = Math.floor(p * 100);
        if (pct >= last + 10) {
          last = pct;
          process.stdout.write(`\rRendu… ${pct} %`);
        }
      },
    });
    console.log(`\nVidéo prête : ${path.resolve(out)}`);
    return;
  }

  if (cmd === "prompt") {
    console.log(buildAnimationPrompt({ description: need(flags, "description"), universe: flags.universe }));
    return;
  }

  if (cmd === "animate") {
    const format = adFormatSchema.parse(flags.format ?? "story");
    const providerName = (flags.provider ?? "runway") as VideoProviderName;
    const provider = createVideoProvider(providerName);
    const image = need(flags, "image");
    const duration = (Number(flags.duration ?? 5) === 10 ? 10 : 5) as 5 | 10;
    const prompt = flags.prompt ?? buildAnimationPrompt({ description: need(flags, "description"), universe: flags.universe, durationSeconds: duration });
    const isUrl = /^https:/.test(image);
    const input = {
      imageUrl: isUrl ? image : undefined,
      imageBuffer: isUrl ? undefined : fs.readFileSync(path.resolve(image)),
      imageMime: image.endsWith(".jpg") || image.endsWith(".jpeg") ? "image/jpeg" : image.endsWith(".webp") ? "image/webp" : "image/png",
      prompt,
      durationSeconds: duration,
      ratio: RATIO[format],
    };
    try {
      console.log(`Coût estimé : ${provider.estimateCostUsd(duration).toFixed(2)} $ (${provider.name})`);
      const { jobId } = await provider.generateFromImage(input);
      console.log(`Tâche ${jobId} lancée, attente du résultat…`);
      const state = await waitForVideo(provider, jobId, { onProgress: (s) => process.stdout.write(`\r${s.status} ${s.progress != null ? Math.round(s.progress * 100) + " %" : ""}   `) });
      if (state.status !== "succeeded" || !state.videoUrl) throw new Error(state.error ?? "Échec de la génération");
      const out = flags.out ?? "clip.mp4";
      await download(state.videoUrl, out);
      console.log(`\nClip prêt : ${path.resolve(out)}`);
    } catch (e) {
      if (e instanceof ManualVideoRequiredError) {
        console.log(e.instructions);
        return;
      }
      throw e;
    }
    return;
  }

  if (cmd === "publish") {
    const res = await publishVideoToShop(need(flags, "shop"), need(flags, "product"), need(flags, "file"), { format: flags.format, title: flags.title });
    console.log(`Vidéo publiée sur la boutique : ${res.url}`);
    return;
  }

  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
}

main().catch((e) => {
  console.error(`Erreur : ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
