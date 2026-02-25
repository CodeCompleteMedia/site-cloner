import { defineCommand } from "citty";
import { resolve } from "pathe";
import { compareDirectories } from "../diff/comparator.js";
import { createScopedLogger } from "../utils/logger.js";
import { writeJSON } from "../utils/fs.js";
import { DEFAULT_PASS_THRESHOLD } from "../types/config.js";

const log = createScopedLogger("diff");

export const diffCommand = defineCommand({
  meta: {
    name: "diff",
    description: "Compare two screenshot directories pixel-by-pixel",
  },
  args: {
    dirA: {
      type: "positional",
      description: "First screenshot directory (original)",
      required: true,
    },
    dirB: {
      type: "positional",
      description: "Second screenshot directory (generated)",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output directory for diff results",
      default: "./diff-output",
    },
    threshold: {
      type: "string",
      alias: "t",
      description: "Pass threshold percentage (0-100)",
      default: String(DEFAULT_PASS_THRESHOLD),
    },
  },
  async run({ args }) {
    const dirA = resolve(args.dirA);
    const dirB = resolve(args.dirB);
    const outputDir = resolve(args.output);
    const threshold = Number(args.threshold);

    log.info(`Comparing ${dirA} vs ${dirB}`);
    log.info(`Pass threshold: ${threshold}%`);

    const result = await compareDirectories(dirA, dirB, outputDir, threshold);

    await writeJSON(resolve(outputDir, "diff-result.json"), result);

    for (const score of result.overallScores) {
      const icon = score.matchPercentage >= threshold ? "✓" : "✗";
      log.info(`${icon} ${score.viewport}px: ${score.matchPercentage.toFixed(1)}% match`);
    }

    if (result.passed) {
      log.success("All viewports passed!");
    } else {
      log.warn("Some viewports did not meet the threshold");
    }
  },
});
