import { writeFile } from "node:fs/promises";
import { resolve, extname } from "pathe";
import { ensureDir } from "../utils/fs.js";
import { resolveUrl } from "../utils/url.js";
import { hashContent } from "./hasher.js";
import { createScopedLogger } from "../utils/logger.js";
import type { AssetManifest, AssetEntry } from "../types/assets.js";

const log = createScopedLogger("downloader");

interface DownloadOptions {
  concurrency: number;
  retries: number;
  timeout?: number;
}

export async function downloadAssets(
  manifest: AssetManifest,
  outputDir: string,
  options: DownloadOptions
): Promise<AssetManifest> {
  const { concurrency, retries, timeout = 30000 } = options;

  await ensureDir(resolve(outputDir, "images"));
  await ensureDir(resolve(outputDir, "fonts"));
  await ensureDir(resolve(outputDir, "svgs"));

  const updatedAssets: AssetEntry[] = [];
  const queue = [...manifest.assets];
  const active: Promise<void>[] = [];

  async function processAsset(asset: AssetEntry): Promise<AssetEntry> {
    const absoluteUrl = resolveUrl(asset.originalUrl, manifest.baseUrl);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(absoluteUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "clone-engine/0.1.0" },
        });
        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const hash = hashContent(buffer);
        const ext = extname(new URL(absoluteUrl).pathname) || guessExtension(response.headers.get("content-type"));
        const subdir = getSubdir(asset.type);
        const hashedFilename = `${hash}${ext}`;
        const localPath = resolve(outputDir, subdir, hashedFilename);

        await writeFile(localPath, buffer);

        return {
          ...asset,
          localPath,
          hashedFilename,
          mimeType: response.headers.get("content-type") || undefined,
          size: buffer.length,
        };
      } catch (err) {
        lastError = err as Error;
        if (attempt < retries) {
          const delay = Math.min(1000 * 2 ** attempt, 5000);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    log.warn(`Failed to download ${absoluteUrl}: ${lastError?.message}`);
    return asset;
  }

  // Process with concurrency limit
  let index = 0;
  const results: AssetEntry[] = new Array(queue.length);

  async function worker(): Promise<void> {
    while (index < queue.length) {
      const i = index++;
      const asset = queue[i]!;
      log.info(`Downloading [${i + 1}/${queue.length}] ${asset.originalUrl}`);
      results[i] = await processAsset(asset);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);

  return {
    baseUrl: manifest.baseUrl,
    assets: results,
  };
}

function getSubdir(type: AssetEntry["type"]): string {
  switch (type) {
    case "image": return "images";
    case "font": return "fonts";
    case "svg": return "svgs";
    default: return "images";
  }
}

function guessExtension(contentType: string | null): string {
  if (!contentType) return "";
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico",
    "font/woff": ".woff",
    "font/woff2": ".woff2",
    "font/ttf": ".ttf",
    "application/font-woff": ".woff",
    "application/font-woff2": ".woff2",
  };
  return map[contentType.split(";")[0]!.trim()] || "";
}
