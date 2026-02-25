import type { Page } from "playwright";
import type { DiscoveredRoute } from "../types/extraction.js";
import { isInternalUrl, getUrlPath } from "../utils/url.js";
import { createScopedLogger } from "../utils/logger.js";

const log = createScopedLogger("route-discoverer");

export async function discoverRoutes(page: Page, baseUrl: string): Promise<DiscoveredRoute[]> {
  log.info("Discovering routes...");

  const links = await page.evaluate(() => {
    const anchors = document.querySelectorAll("a[href]");
    return [...anchors].map((a) => ({
      href: (a as HTMLAnchorElement).href,
      text: a.textContent?.trim() || "",
    }));
  });

  const seen = new Set<string>();
  const routes: DiscoveredRoute[] = [];

  for (const link of links) {
    if (!link.href || link.href.startsWith("javascript:") || link.href.startsWith("mailto:") || link.href.startsWith("tel:")) {
      continue;
    }

    const isExternal = !isInternalUrl(link.href, baseUrl);
    const path = isExternal ? link.href : getUrlPath(link.href);

    if (seen.has(path)) continue;
    seen.add(path);

    routes.push({
      path,
      label: link.text || undefined,
      isExternal,
    });
  }

  log.success(`Found ${routes.length} routes (${routes.filter((r) => !r.isExternal).length} internal)`);
  return routes;
}
