import type { Page } from "playwright";
import type { BoundingBox } from "../types/extraction.js";
import { createScopedLogger } from "../utils/logger.js";
import { createHash } from "node:crypto";

const log = createScopedLogger("section-detector");

export interface DetectedSection {
  id: string;
  name: string;
  landmark: string;
  selector: string;
  boundingBox: BoundingBox;
}

const LANDMARK_SELECTORS = [
  "header",
  "nav:not(header nav):not(footer nav)",
  "main",
  "[role='banner']",
  "[role='navigation']",
  "[role='main']",
  "[role='complementary']",
  "aside",
  "footer",
  "[role='contentinfo']",
];

const MAX_SECTION_HEIGHT = 3000;

export async function detectSections(page: Page): Promise<DetectedSection[]> {
  log.info("Detecting page sections...");

  const sections = await page.evaluate(
    ({ landmarks, maxHeight }) => {
      const found: {
        name: string;
        landmark: string;
        selector: string;
        boundingBox: { x: number; y: number; width: number; height: number };
      }[] = [];
      const seen = new Set<Element>();

      // First pass: landmark elements
      for (const selector of landmarks) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (seen.has(el)) continue;
          seen.add(el);

          const rect = el.getBoundingClientRect();
          if (rect.height === 0 || rect.width === 0) continue;

          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute("role") || "";
          const name = role || tag;

          found.push({
            name,
            landmark: tag,
            selector: buildUniqueSelector(el),
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y + window.scrollY),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          });
        }
      }

      // Fallback: if fewer than 2 sections found, use direct body children
      if (found.length < 2) {
        found.length = 0;
        seen.clear();
        const bodyChildren = document.body.children;
        for (let i = 0; i < bodyChildren.length; i++) {
          const el = bodyChildren[i]!;
          const rect = el.getBoundingClientRect();
          if (rect.height < 20 || rect.width < 100) continue;

          const computed = window.getComputedStyle(el);
          if (computed.display === "none" || computed.visibility === "hidden") continue;

          found.push({
            name: `section-${i}`,
            landmark: el.tagName.toLowerCase(),
            selector: buildUniqueSelector(el),
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y + window.scrollY),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          });
        }
      }

      function buildUniqueSelector(el: Element): string {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const tag = el.tagName.toLowerCase();
        const parent = el.parentElement;
        if (!parent) return tag;
        const siblings = [...parent.children].filter((c) => c.tagName === el.tagName);
        if (siblings.length === 1) {
          return `${buildUniqueSelector(parent)} > ${tag}`;
        }
        const index = siblings.indexOf(el) + 1;
        return `${buildUniqueSelector(parent)} > ${tag}:nth-of-type(${index})`;
      }

      return found;
    },
    { landmarks: LANDMARK_SELECTORS, maxHeight: MAX_SECTION_HEIGHT }
  );

  // Generate stable IDs
  const result: DetectedSection[] = sections.map((s) => {
    const hash = createHash("sha256")
      .update(s.name + s.selector)
      .digest("hex")
      .slice(0, 6);
    return {
      id: `${s.name}-${hash}`,
      name: s.name,
      landmark: s.landmark,
      selector: s.selector,
      boundingBox: s.boundingBox,
    };
  });

  // Sort by Y position
  result.sort((a, b) => a.boundingBox.y - b.boundingBox.y);

  log.success(`Detected ${result.length} sections`);
  return result;
}
