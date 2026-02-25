import type { Page } from "playwright";
import type { DOMNode, BoundingBox } from "../types/extraction.js";
import { createScopedLogger } from "../utils/logger.js";

const log = createScopedLogger("dom-extractor");

/**
 * Inherited CSS properties that should be skipped during deduplication.
 * If a child has the same value as parent for these, we don't store them.
 */
const INHERITED_PROPERTIES = new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "visibility",
  "cursor",
  "direction",
  "word-spacing",
  "white-space",
]);

/** Key computed style properties to extract */
const STYLE_PROPERTIES = [
  "display",
  "position",
  "width",
  "height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-radius",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration",
  "text-transform",
  "opacity",
  "overflow",
  "z-index",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "align-self",
  "flex-grow",
  "flex-shrink",
  "gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "box-shadow",
  "transform",
  "transition",
  "max-width",
  "min-width",
  "max-height",
  "min-height",
  "top",
  "right",
  "bottom",
  "left",
];

export async function extractDOM(
  page: Page,
  rootSelector: string = "body"
): Promise<DOMNode> {
  log.info(`Extracting DOM from ${rootSelector}`);

  const domTree = await page.evaluate(
    ({ selector, styleProps, inheritedProps }) => {
      function extractNode(
        el: Element,
        parentStyles: Record<string, string> | null,
        depth: number
      ): any {
        if (depth > 20) return null;

        const computed = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Skip invisible elements
        if (
          computed.display === "none" ||
          (rect.width === 0 && rect.height === 0)
        ) {
          return null;
        }

        const computedStyles: Record<string, string> = {};
        const uniqueStyles: Record<string, string> = {};

        for (const prop of styleProps) {
          const value = computed.getPropertyValue(prop);
          if (value) {
            computedStyles[prop] = value;
            // Only store unique (non-inherited-from-parent) values
            if (
              !parentStyles ||
              !inheritedProps.includes(prop) ||
              parentStyles[prop] !== value
            ) {
              uniqueStyles[prop] = value;
            }
          }
        }

        const children: any[] = [];
        for (const child of el.children) {
          const extracted = extractNode(child, computedStyles, depth + 1);
          if (extracted) children.push(extracted);
        }

        // Get direct text content (not from children)
        let textContent: string | undefined;
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
              textContent = (textContent ? textContent + " " : "") + text;
            }
          }
        }

        const attrs: Record<string, string> = {};
        for (const attr of el.attributes) {
          if (!["style", "class", "id"].includes(attr.name)) {
            attrs[attr.name] = attr.value;
          }
        }

        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          classNames: [...el.classList],
          attributes: attrs,
          computedStyles,
          uniqueStyles,
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          children,
          textContent,
        };
      }

      const root = document.querySelector(selector);
      if (!root) throw new Error(`Root element not found: ${selector}`);
      return extractNode(root, null, 0);
    },
    {
      selector: rootSelector,
      styleProps: STYLE_PROPERTIES,
      inheritedProps: [...INHERITED_PROPERTIES],
    }
  );

  return domTree as DOMNode;
}
