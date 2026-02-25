import type { Page } from "playwright";
import type { CSSVariable, FontInfo, DesignTokens } from "../types/extraction.js";
import { createScopedLogger } from "../utils/logger.js";

const log = createScopedLogger("style-extractor");

export async function extractDesignTokens(page: Page): Promise<DesignTokens> {
  log.info("Extracting design tokens...");

  const [cssVariables, fonts, colors, spacingValues] = await Promise.all([
    extractCSSVariables(page),
    extractFontInfo(page),
    extractColors(page),
    extractSpacing(page),
  ]);

  log.success(`Found ${cssVariables.length} CSS vars, ${fonts.length} fonts, ${colors.length} colors`);
  return { cssVariables, fonts, colors, spacingValues };
}

async function extractCSSVariables(page: Page): Promise<CSSVariable[]> {
  return page.evaluate(() => {
    const variables: { name: string; value: string; scope: string }[] = [];

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i]!;
              if (prop.startsWith("--")) {
                variables.push({
                  name: prop,
                  value: style.getPropertyValue(prop).trim(),
                  scope: rule.selectorText,
                });
              }
            }
          }
        }
      } catch {
        // CORS stylesheet, skip
      }
    }

    // Also get computed variables from :root
    const rootStyles = window.getComputedStyle(document.documentElement);
    const rootVars = variables.filter((v) => v.scope === ":root");
    // Update with computed values
    for (const v of rootVars) {
      v.value = rootStyles.getPropertyValue(v.name).trim();
    }

    return variables;
  });
}

async function extractFontInfo(page: Page): Promise<FontInfo[]> {
  return page.evaluate(() => {
    const fontMap = new Map<string, { weights: Set<string>; styles: Set<string>; src: string[] }>();

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSFontFaceRule) {
            const family = rule.style.getPropertyValue("font-family").replace(/['"]/g, "").trim();
            const weight = rule.style.getPropertyValue("font-weight") || "400";
            const style = rule.style.getPropertyValue("font-style") || "normal";
            const src = rule.style.getPropertyValue("src") || "";

            if (!fontMap.has(family)) {
              fontMap.set(family, { weights: new Set(), styles: new Set(), src: [] });
            }
            const entry = fontMap.get(family)!;
            entry.weights.add(weight);
            entry.styles.add(style);
            if (src) entry.src.push(src);
          }
        }
      } catch {
        // CORS stylesheet
      }
    }

    return [...fontMap.entries()].map(([family, info]) => ({
      family,
      weights: [...info.weights],
      styles: [...info.styles],
      src: info.src.length > 0 ? info.src : undefined,
    }));
  });
}

async function extractColors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const colors = new Set<string>();
    const elements = document.querySelectorAll("*");

    for (const el of elements) {
      const computed = window.getComputedStyle(el);
      const color = computed.color;
      const bg = computed.backgroundColor;
      const borderColor = computed.borderColor;

      if (color && color !== "rgba(0, 0, 0, 0)") colors.add(color);
      if (bg && bg !== "rgba(0, 0, 0, 0)") colors.add(bg);
      if (borderColor && borderColor !== "rgba(0, 0, 0, 0)") colors.add(borderColor);
    }

    return [...colors].slice(0, 100); // Cap at 100 unique colors
  });
}

async function extractSpacing(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const spacings = new Set<number>();
    const elements = document.querySelectorAll("*");

    for (const el of elements) {
      const computed = window.getComputedStyle(el);
      for (const prop of [
        "margin-top", "margin-right", "margin-bottom", "margin-left",
        "padding-top", "padding-right", "padding-bottom", "padding-left",
        "gap", "row-gap", "column-gap",
      ]) {
        const value = parseFloat(computed.getPropertyValue(prop));
        if (value > 0 && value < 200) spacings.add(Math.round(value));
      }
    }

    return [...spacings].sort((a, b) => a - b);
  });
}

export async function extractMatchedCSS(page: Page, selector: string): Promise<string> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "";

    const matched: string[] = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            try {
              if (el.matches(rule.selectorText) || el.querySelector(rule.selectorText)) {
                matched.push(rule.cssText);
              }
            } catch {
              // Invalid selector
            }
          }
        }
      } catch {
        // CORS stylesheet
      }
    }
    return matched.join("\n");
  }, selector);
}
