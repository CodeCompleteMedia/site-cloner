import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { createScopedLogger } from "../utils/logger.js";

const log = createScopedLogger("browser");

let browser: Browser | null = null;

export async function launchBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  log.info("Launching browser...");
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  return browser;
}

export async function createPage(
  browser: Browser,
  viewport: { width: number; height: number } = { width: 1440, height: 900 }
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  return { context, page };
}

export async function navigateAndWait(
  page: Page,
  url: string,
  options: { timeout?: number; scrollForLazy?: boolean } = {}
): Promise<void> {
  const { timeout = 30000, scrollForLazy = true } = options;
  log.info(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout });

  if (scrollForLazy) {
    log.info("Scrolling for lazy-loaded content...");
    await autoScroll(page);
    // Wait for any triggered lazy loads to finish
    await page.waitForLoadState("networkidle").catch(() => {});
  }
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
    });
  });
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    log.info("Browser closed");
  }
}
