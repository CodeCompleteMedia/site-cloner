import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "pathe";
import { ensureDir } from "../utils/fs.js";
import { createScopedLogger } from "../utils/logger.js";
import type { DiffResult } from "../types/diff.js";

const log = createScopedLogger("report-generator");

export async function generateReport(
  diffResult: DiffResult,
  outputPath: string
): Promise<void> {
  await ensureDir(dirname(outputPath));

  const sections: string[] = [];

  for (const score of diffResult.overallScores) {
    const statusColor = score.matchPercentage >= diffResult.passThreshold ? "#22c55e" : "#ef4444";
    const statusLabel = score.matchPercentage >= diffResult.passThreshold ? "PASS" : "FAIL";

    let diffImgBase64 = "";
    try {
      const diffBuf = await readFile(score.diffImagePath);
      diffImgBase64 = diffBuf.toString("base64");
    } catch {
      // Diff image may not exist
    }

    sections.push(`
      <div class="viewport-section">
        <div class="viewport-header">
          <h2>${score.viewport}px Viewport</h2>
          <span class="badge" style="background: ${statusColor}">${statusLabel} — ${score.matchPercentage.toFixed(1)}%</span>
        </div>
        <div class="stats">
          <div class="stat">
            <span class="stat-label">Total Pixels</span>
            <span class="stat-value">${score.totalPixels.toLocaleString()}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Different Pixels</span>
            <span class="stat-value">${score.differentPixels.toLocaleString()}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Match %</span>
            <span class="stat-value">${score.matchPercentage.toFixed(2)}%</span>
          </div>
        </div>
        ${diffImgBase64 ? `
        <div class="diff-image">
          <h3>Diff Overlay</h3>
          <img src="data:image/png;base64,${diffImgBase64}" alt="Diff overlay for ${score.viewport}px" />
        </div>
        ` : ""}
      </div>
    `);
  }

  // Section scores
  const sectionRows = diffResult.sectionScores.map((s) => {
    const severityColors: Record<string, string> = {
      pass: "#22c55e",
      minor: "#eab308",
      major: "#f97316",
      critical: "#ef4444",
    };
    return `
      <tr>
        <td>${s.sectionName}</td>
        <td>${s.viewport}px</td>
        <td>${s.matchPercentage.toFixed(1)}%</td>
        <td><span class="badge" style="background: ${severityColors[s.severity] || "#6b7280"}">${s.severity.toUpperCase()}</span></td>
      </tr>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clone Engine — Diff Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.875rem; margin-bottom: 0.5rem; }
    .subtitle { color: #94a3b8; margin-bottom: 2rem; }
    .viewport-section { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .viewport-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .viewport-header h2 { font-size: 1.25rem; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; color: white; }
    .stats { display: flex; gap: 2rem; margin-bottom: 1rem; }
    .stat { display: flex; flex-direction: column; }
    .stat-label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; }
    .stat-value { font-size: 1.125rem; font-weight: 600; }
    .diff-image { margin-top: 1rem; }
    .diff-image h3 { font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.5rem; }
    .diff-image img { max-width: 100%; border-radius: 8px; border: 1px solid #334155; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #0f172a; font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; }
    .summary { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Clone Engine — Diff Report</h1>
    <p class="subtitle">Generated ${diffResult.timestamp} | Threshold: ${diffResult.passThreshold}%</p>

    <div class="summary">
      <h2 style="margin-bottom: 1rem;">Summary</h2>
      <div class="summary-grid">
        <div class="stat">
          <span class="stat-label">Overall Result</span>
          <span class="stat-value">${diffResult.passed ? "✅ PASSED" : "❌ FAILED"}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Viewports Tested</span>
          <span class="stat-value">${diffResult.overallScores.length}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Source A</span>
          <span class="stat-value" style="font-size: 0.875rem; word-break: break-all;">${diffResult.sourceA}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Source B</span>
          <span class="stat-value" style="font-size: 0.875rem; word-break: break-all;">${diffResult.sourceB}</span>
        </div>
      </div>
    </div>

    ${sections.join("")}

    ${sectionRows ? `
    <h2 style="margin: 2rem 0 1rem;">Section Scores</h2>
    <table>
      <thead>
        <tr>
          <th>Section</th>
          <th>Viewport</th>
          <th>Match %</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        ${sectionRows}
      </tbody>
    </table>
    ` : ""}
  </div>
</body>
</html>`;

  await writeFile(outputPath, html, "utf-8");
  log.success(`Report written to ${outputPath}`);
}
