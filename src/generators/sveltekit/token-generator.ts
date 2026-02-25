import { resolve } from "pathe";
import { writeFile } from "node:fs/promises";
import { ensureDir } from "../../utils/fs.js";
import { createScopedLogger } from "../../utils/logger.js";
import type { DesignTokens } from "../../types/extraction.js";

const log = createScopedLogger("token-generator");

export async function generateTokensCSS(
  outputDir: string,
  tokens: DesignTokens
): Promise<string> {
  const stylesDir = resolve(outputDir, "src/lib/styles");
  await ensureDir(stylesDir);

  const lines: string[] = [
    "/* Auto-generated design tokens from clone-engine extraction */",
    "",
    ":root {",
  ];

  // CSS variables
  for (const v of tokens.cssVariables) {
    if (v.scope === ":root") {
      lines.push(`  ${v.name}: ${v.value};`);
    }
  }

  lines.push("}");
  lines.push("");

  // Non-root scoped variables
  const scopedVars = tokens.cssVariables.filter((v) => v.scope !== ":root");
  const scopeMap = new Map<string, typeof scopedVars>();
  for (const v of scopedVars) {
    const list = scopeMap.get(v.scope) || [];
    list.push(v);
    scopeMap.set(v.scope, list);
  }
  for (const [scope, vars] of scopeMap) {
    lines.push(`${scope} {`);
    for (const v of vars) {
      lines.push(`  ${v.name}: ${v.value};`);
    }
    lines.push("}");
    lines.push("");
  }

  // Font-face declarations
  for (const font of tokens.fonts) {
    if (font.src) {
      for (const weight of font.weights) {
        for (const style of font.styles) {
          lines.push("@font-face {");
          lines.push(`  font-family: '${font.family}';`);
          lines.push(`  font-weight: ${weight};`);
          lines.push(`  font-style: ${style};`);
          // src will need to be updated to point to local copies
          lines.push(`  /* src: update with local font paths */`);
          lines.push("}");
          lines.push("");
        }
      }
    }
  }

  const css = lines.join("\n");
  const filePath = resolve(stylesDir, "tokens.css");
  await writeFile(filePath, css, "utf-8");

  log.success(`Generated tokens.css (${tokens.cssVariables.length} variables)`);
  return filePath;
}
