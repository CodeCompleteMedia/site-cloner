import { defineCommand } from "citty";
import { resolve } from "pathe";
import { readJSON } from "../utils/fs.js";
import { generateReport } from "../diff/report-generator.js";
import { createScopedLogger } from "../utils/logger.js";
import type { DiffResult } from "../types/diff.js";

const log = createScopedLogger("report");

export const reportCommand = defineCommand({
  meta: {
    name: "report",
    description: "Generate an HTML report from diff results",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to diff-result.json",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output HTML file path",
      default: "./diff-output/report.html",
    },
  },
  async run({ args }) {
    const inputPath = resolve(args.input);
    const outputPath = resolve(args.output);

    log.info(`Generating report from ${inputPath}`);

    const diffResult = await readJSON<DiffResult>(inputPath);
    await generateReport(diffResult, outputPath);

    log.success(`Report generated: ${outputPath}`);
  },
});
