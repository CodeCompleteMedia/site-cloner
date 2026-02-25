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

        if (buffer.length === 0) {
          log.warn(`Empty response body for ${absoluteUrl}, skipping`);
          return asset;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!isValidAssetContent(buffer, contentType, asset.type)) {
          log.warn(`Invalid or corrupt asset from ${absoluteUrl} (${buffer.length} bytes, ${contentType}), skipping`);
          return asset;
        }

        const hash = hashContent(buffer);
        const ext = extname(new URL(absoluteUrl).pathname) || guessExtension(contentType);
        const subdir = getSubdir(asset.type);
        const hashedFilename = `${hash}${ext}`;
        const localPath = resolve(outputDir, subdir, hashedFilename);

        await writeFile(localPath, buffer);

        return {
          ...asset,
          localPath,
          hashedFilename,
          mimeType: contentType || undefined,
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

// PNG: 89 50 4E 47, JPEG: FF D8 FF, GIF: 47 49 46, WebP: 52 49 46 46 ...  57 45 42 50
const IMAGE_SIGNATURES: [number[], string][] = [
  [[0x89, 0x50, 0x4e, 0x47], "png"],
  [[0xff, 0xd8, 0xff], "jpeg"],
  [[0x47, 0x49, 0x46, 0x38], "gif"],
  [[0x52, 0x49, 0x46, 0x46], "webp/riff"],
];

function isValidAssetContent(buffer: Buffer, contentType: string, type: AssetEntry["type"]): boolean {
  // Fonts: just check minimum reasonable size (a valid font is at least ~100 bytes)
  if (type === "font") return buffer.length >= 100;

  // SVGs: should contain an <svg tag
  if (type === "svg" || contentType.includes("svg")) {
    const text = buffer.toString("utf-8", 0, Math.min(buffer.length, 1024));
    return text.includes("<svg") || text.includes("<?xml");
  }

  // Images: check for valid magic bytes or reasonable HTML error pages returned as images
  if (type === "image") {
    // Reject tiny images that are likely broken (< 67 bytes is smaller than any valid image)
    if (buffer.length < 67) return false;

    // Check if the server returned an HTML error page instead of an image
    const head = buffer.toString("utf-8", 0, Math.min(buffer.length, 64));
    if (head.trimStart().startsWith("<!DOCTYPE") || head.trimStart().startsWith("<html")) return false;

    // Check for known image magic bytes
    for (const [sig] of IMAGE_SIGNATURES) {
      if (sig.every((byte, i) => buffer[i] === byte)) return true;
    }

    // ICO files: 00 00 01 00
    if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) return true;

    // If content-type says image but no known signature, still allow it
    if (contentType.startsWith("image/")) return true;
  }

  // For "other" types, allow anything non-empty
  return true;
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
