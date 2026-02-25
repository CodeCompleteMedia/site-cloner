import { defineCommand, runMain } from "citty";
import { extractCommand } from "./commands/extract.js";
import { assetsCommand } from "./commands/assets.js";
import { screenshotCommand } from "./commands/screenshot.js";
import { diffCommand } from "./commands/diff.js";
import { reportCommand } from "./commands/report.js";

const main = defineCommand({
  meta: {
    name: "clone-engine",
    version: "0.1.0",
    description:
      "Deterministic website extraction, screenshotting, and pixel-diffing engine",
  },
  subCommands: {
    extract: extractCommand,
    assets: assetsCommand,
    screenshot: screenshotCommand,
    diff: diffCommand,
    report: reportCommand,
  },
});

runMain(main);
