import { resolve } from "pathe";
import { launchBrowser, createPage, navigateAndWait, closeBrowser } from "../extract/browser.js";
import { ensureDir } from "../utils/fs.js";
import { sanitizeFilename } from "../utils/url.js";
import { createScopedLogger } from "../utils/logger.js";
import type { ScreenshotConfig } from "../types/config.js";

const log = createScopedLogger("capturer");

export interface ScreenshotResult {
  viewport: number;
  path: string;
  width: number;
  height: number;
}

export async function captureScreenshots(
  config: ScreenshotConfig
): Promise<ScreenshotResult[]> {
  const { url, outputDir, viewports, fullPage = true, scrollForLazyContent = true, timeout = 30000 } = config;
  await ensureDir(outputDir);

  const browser = await launchBrowser();
  const results: ScreenshotResult[] = [];

  try {
    for (const vw of viewports) {
      log.info(`Capturing at ${vw}px...`);
      const { context, page } = await createPage(browser, { width: vw, height: 900 });

      try {
        await navigateAndWait(page, url, { timeout, scrollForLazy: scrollForLazyContent });

        // Scroll back to top before capture
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        const filename = `${sanitizeFilename(url)}-${vw}px.png`;
        const filepath = resolve(outputDir, filename);

        await page.screenshot({
          path: filepath,
          fullPage,
          type: "png",
        });

        const dimensions = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        }));

        results.push({
          viewport: vw,
          path: filepath,
          width: dimensions.width,
          height: dimensions.height,
        });

        log.success(`Captured ${vw}px: ${dimensions.width}x${dimensions.height}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await closeBrowser();
  }

  return results;
}
