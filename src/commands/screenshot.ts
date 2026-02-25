import { defineCommand } from "citty";
import { resolve } from "pathe";
import { captureScreenshots } from "../screenshot/capturer.js";
import { createScopedLogger } from "../utils/logger.js";
import { DEFAULT_VIEWPORTS } from "../types/config.js";

const log = createScopedLogger("screenshot");

export const screenshotCommand = defineCommand({
  meta: {
    name: "screenshot",
    description: "Capture full-page screenshots at multiple viewports",
  },
  args: {
    url: {
      type: "positional",
      description: "URL to screenshot",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output directory",
      default: "./screenshots",
    },
    viewports: {
      type: "string",
      alias: "v",
      description: "Comma-separated viewport widths",
      default: DEFAULT_VIEWPORTS.join(","),
    },
    timeout: {
      type: "string",
      alias: "t",
      description: "Navigation timeout in ms",
      default: "30000",
    },
    "no-scroll": {
      type: "boolean",
      description: "Disable auto-scrolling for lazy content",
      default: false,
    },
  },
  async run({ args }) {
    const url = args.url;
    const outputDir = resolve(args.output);
    const viewports = args.viewports.split(",").map(Number);
    const timeout = Number(args.timeout);
    const scrollForLazy = !args["no-scroll"];

    log.info(`Screenshotting ${url}`);
    log.info(`Viewports: ${viewports.join(", ")}px`);

    const results = await captureScreenshots({
      url,
      outputDir,
      viewports,
      fullPage: true,
      scrollForLazyContent: scrollForLazy,
      timeout,
    });

    for (const r of results) {
      log.success(`${r.viewport}px → ${r.path}`);
    }
  },
});
