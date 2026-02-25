import type { Page } from "playwright";
import type { IconLibrary } from "../types/extraction.js";
import { createScopedLogger } from "../utils/logger.js";

const log = createScopedLogger("icon-detector");

interface IconPattern {
  name: string;
  classPrefix?: string;
  fontFamily?: string;
  cdnPatterns?: RegExp[];
}

const KNOWN_ICON_LIBRARIES: IconPattern[] = [
  {
    name: "Font Awesome",
    classPrefix: "fa-",
    fontFamily: "Font Awesome",
    cdnPatterns: [/fontawesome/, /font-awesome/],
  },
  {
    name: "Material Icons",
    classPrefix: "material-icons",
    fontFamily: "Material Icons",
    cdnPatterns: [/fonts\.googleapis\.com.*material.*icons/],
  },
  {
    name: "Lucide",
    classPrefix: "lucide-",
    cdnPatterns: [/lucide/],
  },
  {
    name: "Heroicons",
    cdnPatterns: [/heroicons/],
  },
  {
    name: "Tabler Icons",
    classPrefix: "ti-",
    cdnPatterns: [/tabler-icons/, /tabler.*icons/],
  },
  {
    name: "Bootstrap Icons",
    classPrefix: "bi-",
    fontFamily: "bootstrap-icons",
    cdnPatterns: [/bootstrap-icons/],
  },
  {
    name: "Phosphor Icons",
    classPrefix: "ph-",
    cdnPatterns: [/phosphor/],
  },
  {
    name: "Remix Icons",
    classPrefix: "ri-",
    cdnPatterns: [/remixicon/],
  },
];

export async function detectIconLibraries(page: Page): Promise<IconLibrary[]> {
  log.info("Detecting icon libraries...");

  const detected: IconLibrary[] = [];
  const seen = new Set<string>();

  // Check CDN links in <head>
  const headLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('link[href], script[src]');
    return [...links].map((el) => (el as HTMLLinkElement).href || (el as HTMLScriptElement).src).filter(Boolean);
  });

  for (const lib of KNOWN_ICON_LIBRARIES) {
    // Check CDN URLs
    if (lib.cdnPatterns) {
      for (const pattern of lib.cdnPatterns) {
        const match = headLinks.find((url) => pattern.test(url));
        if (match && !seen.has(lib.name)) {
          seen.add(lib.name);
          detected.push({
            name: lib.name,
            detectedBy: "cdn-url",
            cdnUrl: match,
            prefix: lib.classPrefix,
          });
        }
      }
    }
  }

  // Check class prefixes in DOM
  const classNames = await page.evaluate(() => {
    const allClasses = new Set<string>();
    document.querySelectorAll("*").forEach((el) => {
      el.classList.forEach((c) => allClasses.add(c));
    });
    return [...allClasses];
  });

  for (const lib of KNOWN_ICON_LIBRARIES) {
    if (seen.has(lib.name)) continue;
    if (lib.classPrefix) {
      const hasPrefix = classNames.some((c) => c.startsWith(lib.classPrefix!));
      if (hasPrefix) {
        seen.add(lib.name);
        detected.push({
          name: lib.name,
          detectedBy: "class-prefix",
          prefix: lib.classPrefix,
        });
      }
    }
  }

  // Check SVG sprite usage
  const hasSvgSprites = await page.evaluate(() => {
    return document.querySelectorAll("svg use[href], svg use[xlink\\:href]").length > 0;
  });

  if (hasSvgSprites && !seen.has("SVG Sprites")) {
    detected.push({
      name: "SVG Sprites",
      detectedBy: "svg-sprite",
    });
  }

  log.success(`Detected ${detected.length} icon libraries`);
  return detected;
}
