import { defineCommand } from "citty";
import { resolve } from "pathe";
import { readJSON } from "../utils/fs.js";
import { downloadAssets } from "../assets/downloader.js";
import { createScopedLogger } from "../utils/logger.js";
import type { ExtractionResult } from "../types/extraction.js";

const log = createScopedLogger("assets");

export const assetsCommand = defineCommand({
  meta: {
    name: "assets",
    description: "Download all assets referenced in an extraction",
  },
  args: {
    dir: {
      type: "positional",
      description: "Extraction directory",
      required: true,
    },
    concurrency: {
      type: "string",
      alias: "c",
      description: "Max concurrent downloads",
      default: "5",
    },
    retries: {
      type: "string",
      alias: "r",
      description: "Retry count per asset",
      default: "3",
    },
  },
  async run({ args }) {
    const extractionDir = resolve(args.dir);
    const concurrency = Number(args.concurrency);
    const retries = Number(args.retries);

    log.info(`Loading extraction from ${extractionDir}`);
    const extraction = await readJSON<ExtractionResult>(
      resolve(extractionDir, "extraction.json")
    );

    const assetsDir = resolve(extractionDir, "assets");
    log.info(`Downloading ${extraction.assetManifest.assets.length} assets to ${assetsDir}`);

    const manifest = await downloadAssets(extraction.assetManifest, assetsDir, {
      concurrency,
      retries,
    });

    log.success(`Downloaded ${manifest.assets.filter((a) => a.localPath).length} assets`);
  },
});
