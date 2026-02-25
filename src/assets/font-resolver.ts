import { resolve } from "pathe";
import { writeFile } from "node:fs/promises";
import { ensureDir } from "../utils/fs.js";
import { resolveUrl } from "../utils/url.js";
import { hashContent } from "./hasher.js";
import { createScopedLogger } from "../utils/logger.js";
import type { FontInfo } from "../types/extraction.js";

const log = createScopedLogger("font-resolver");

export interface ResolvedFont {
  family: string;
  weight: string;
  style: string;
  localPath: string;
  format: string;
}

export async function resolveFonts(
  fonts: FontInfo[],
  baseUrl: string,
  outputDir: string
): Promise<ResolvedFont[]> {
  const fontsDir = resolve(outputDir, "fonts");
  await ensureDir(fontsDir);

  const resolved: ResolvedFont[] = [];

  for (const font of fonts) {
    if (!font.src) continue;

    for (const srcStr of font.src) {
      // Parse url() from @font-face src
      const urlMatches = srcStr.matchAll(/url\(["']?(.+?)["']?\)\s*format\(["']?(.+?)["']?\)/g);

      for (const match of urlMatches) {
        const url = match[1];
        const format = match[2];
        if (!url || !format) continue;

        const absoluteUrl = resolveUrl(url, baseUrl);

        try {
          const response = await fetch(absoluteUrl, {
            headers: { "User-Agent": "clone-engine/0.1.0" },
          });

          if (!response.ok) {
            log.warn(`Failed to download font ${absoluteUrl}: ${response.status}`);
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          const hash = hashContent(buffer);
          const ext = getExtForFormat(format);
          const filename = `${font.family.replace(/\s+/g, "-").toLowerCase()}-${hash}${ext}`;
          const localPath = resolve(fontsDir, filename);

          await writeFile(localPath, buffer);

          for (const weight of font.weights) {
            for (const style of font.styles) {
              resolved.push({
                family: font.family,
                weight,
                style,
                localPath,
                format,
              });
            }
          }

          log.info(`Downloaded font: ${font.family} → ${filename}`);
        } catch (err) {
          log.warn(`Error downloading font ${absoluteUrl}: ${(err as Error).message}`);
        }
      }
    }
  }

  return resolved;
}

function getExtForFormat(format: string): string {
  const map: Record<string, string> = {
    woff2: ".woff2",
    woff: ".woff",
    truetype: ".ttf",
    opentype: ".otf",
    "embedded-opentype": ".eot",
  };
  return map[format.toLowerCase()] || `.${format}`;
}
