import { defineCommand } from "citty";
import { resolve } from "pathe";
import { launchBrowser, createPage, navigateAndWait, closeBrowser } from "../extract/browser.js";
import { extractDOM } from "../extract/dom-extractor.js";
import { extractDesignTokens, extractMatchedCSS } from "../extract/style-extractor.js";
import { detectSections } from "../extract/section-detector.js";
import { discoverRoutes } from "../extract/route-discoverer.js";
import { detectIconLibraries } from "../extract/icon-detector.js";
import { ensureDir, writeJSON } from "../utils/fs.js";
import { normalizeUrl } from "../utils/url.js";
import { createScopedLogger } from "../utils/logger.js";
import { DEFAULT_VIEWPORTS } from "../types/config.js";
import type { ExtractionResult, ExtractionMeta, PageSection } from "../types/extraction.js";
import type { AssetManifest } from "../types/assets.js";

const log = createScopedLogger("extract");

export const extractCommand = defineCommand({
  meta: {
    name: "extract",
    description: "Extract page structure, styles, and assets from a URL",
  },
  args: {
    url: {
      type: "positional",
      description: "URL to extract from",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output directory",
      default: "./extraction",
    },
    viewports: {
      type: "string",
      alias: "v",
      description: "Comma-separated viewport widths",
      default: DEFAULT_VIEWPORTS.join(","),
    },
    timeout: {
      type: "string",
      alias: "t",
      description: "Navigation timeout in ms",
      default: "30000",
    },
    "no-scroll": {
      type: "boolean",
      description: "Disable auto-scrolling for lazy content",
      default: false,
    },
  },
  async run({ args }) {
    const url = normalizeUrl(args.url);
    const outputDir = resolve(args.output);
    const viewports = args.viewports.split(",").map(Number);
    const timeout = Number(args.timeout);
    const scrollForLazy = !args["no-scroll"];

    log.info(`Extracting ${url}`);
    log.info(`Viewports: ${viewports.join(", ")}px`);
    log.info(`Output: ${outputDir}`);

    await ensureDir(outputDir);
    await ensureDir(resolve(outputDir, "sections"));

    const browser = await launchBrowser();
    const allSections: PageSection[] = [];
    let meta: ExtractionMeta | undefined;
    let tokens: ExtractionResult["tokens"] | undefined;

    try {
      for (const vw of viewports) {
        log.info(`--- Viewport: ${vw}px ---`);
        const { context, page } = await createPage(browser, { width: vw, height: 900 });

        try {
          await navigateAndWait(page, url, { timeout, scrollForLazy });

          // Only extract meta/tokens/routes/icons on first viewport
          if (!meta) {
            const title = await page.title();
            const description = await page
              .locator('meta[name="description"]')
              .getAttribute("content")
              .catch(() => "");

            const [iconLibraries, routes] = await Promise.all([
              detectIconLibraries(page),
              discoverRoutes(page, url),
            ]);

            tokens = await extractDesignTokens(page);

            meta = {
              url,
              title,
              description: description || "",
              extractedAt: new Date().toISOString(),
              viewports,
              iconLibraries,
              routes,
            };
          }

          // Detect sections and extract each one
          const detected = await detectSections(page);

          for (const section of detected) {
            log.info(`Extracting section: ${section.name} (${section.selector})`);
            const dom = await extractDOM(page, section.selector);
            const matchedCSS = await extractMatchedCSS(page, section.selector);

            const pageSection: PageSection = {
              id: section.id,
              name: section.name,
              landmark: section.landmark,
              boundingBox: section.boundingBox,
              dom,
              matchedCSS,
              viewport: vw,
            };

            allSections.push(pageSection);

            // Write individual section file
            await writeJSON(
              resolve(outputDir, "sections", `${section.id}-${vw}.json`),
              pageSection
            );
          }
        } finally {
          await context.close();
        }
      }

      // Collect asset URLs from DOM
      const assetManifest = collectAssetUrls(allSections, url);

      const result: ExtractionResult = {
        meta: meta!,
        tokens: tokens!,
        sections: [], // Section data is in individual files
        assetManifest,
      };

      await writeJSON(resolve(outputDir, "extraction.json"), result);

      log.success(`Extraction complete! ${allSections.length} sections across ${viewports.length} viewports`);
      log.info(`Output: ${outputDir}`);
    } finally {
      await closeBrowser();
    }
  },
});

function collectAssetUrls(sections: PageSection[], baseUrl: string): AssetManifest {
  const urls = new Set<string>();

  function walkNode(node: { attributes?: Record<string, string>; computedStyles?: Record<string, string>; children?: any[] }) {
    if (node.attributes) {
      if (node.attributes["src"]) urls.add(node.attributes["src"]);
      if (node.attributes["href"] && /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)(\?|$)/i.test(node.attributes["href"])) {
        urls.add(node.attributes["href"]);
      }
      if (node.attributes["srcset"]) {
        node.attributes["srcset"].split(",").forEach((s) => {
          const url = s.trim().split(/\s+/)[0];
          if (url) urls.add(url);
        });
      }
    }

    if (node.computedStyles?.["background-image"]) {
      const bgImg = node.computedStyles["background-image"];
      const urlMatches = bgImg.matchAll(/url\(["']?(.+?)["']?\)/g);
      for (const match of urlMatches) {
        if (match[1] && !match[1].startsWith("data:")) urls.add(match[1]);
      }
    }

    if (node.children) {
      for (const child of node.children) walkNode(child);
    }
  }

  for (const section of sections) {
    walkNode(section.dom);
  }

  return {
    baseUrl,
    assets: [...urls].map((originalUrl) => ({
      originalUrl,
      localPath: "",
      hashedFilename: "",
      type: guessAssetType(originalUrl),
      mimeType: undefined,
      size: undefined,
    })),
  };
}

function guessAssetType(url: string): "image" | "font" | "svg" | "other" {
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg")) return "svg";
  if (/\.(png|jpg|jpeg|gif|webp|ico|avif)/.test(lower)) return "image";
  if (/\.(woff2?|ttf|eot|otf)/.test(lower)) return "font";
  return "other";
}
