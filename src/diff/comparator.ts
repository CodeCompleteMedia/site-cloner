import { resolve, basename } from "pathe";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { ensureDir, listFiles } from "../utils/fs.js";
import { createScopedLogger } from "../utils/logger.js";
import type { DiffResult, PixelDiffResult } from "../types/diff.js";

const log = createScopedLogger("comparator");

export async function compareDirectories(
  dirA: string,
  dirB: string,
  outputDir: string,
  threshold: number
): Promise<DiffResult> {
  await ensureDir(outputDir);

  const filesA = await listFiles(dirA, ".png");
  const filesB = await listFiles(dirB, ".png");

  // Match files by viewport width pattern
  const pairs = matchFilesByViewport(filesA, filesB);

  if (pairs.length === 0) {
    log.warn("No matching screenshot pairs found!");
    return {
      timestamp: new Date().toISOString(),
      sourceA: dirA,
      sourceB: dirB,
      overallScores: [],
      sectionScores: [],
      passed: false,
      passThreshold: threshold,
    };
  }

  const overallScores: PixelDiffResult[] = [];

  for (const { fileA, fileB, viewport } of pairs) {
    log.info(`Comparing ${viewport}px screenshots...`);
    const result = await compareImages(fileA, fileB, outputDir, viewport);
    overallScores.push(result);
  }

  const passed = overallScores.every((s) => s.matchPercentage >= threshold);

  return {
    timestamp: new Date().toISOString(),
    sourceA: dirA,
    sourceB: dirB,
    overallScores,
    sectionScores: [],
    passed,
    passThreshold: threshold,
  };
}

export async function compareImages(
  pathA: string,
  pathB: string,
  outputDir: string,
  viewport: number
): Promise<PixelDiffResult> {
  // Read and normalize both images to same dimensions
  const [imgA, imgB] = await Promise.all([
    loadAndNormalize(pathA),
    loadAndNormalize(pathB),
  ]);

  // Ensure same dimensions by padding the smaller one
  const width = Math.max(imgA.width, imgB.width);
  const height = Math.max(imgA.height, imgB.height);

  const bufA = await padImage(imgA, width, height);
  const bufB = await padImage(imgB, width, height);

  const pngA = PNG.sync.read(bufA);
  const pngB = PNG.sync.read(bufB);

  const diff = new PNG({ width, height });
  const differentPixels = pixelmatch(
    pngA.data,
    pngB.data,
    diff.data,
    width,
    height,
    {
      threshold: 0.1,
      includeAA: false,
      alpha: 0.3,
      diffColor: [255, 0, 0],
      diffColorAlt: [0, 0, 255],
    }
  );

  const diffImagePath = resolve(outputDir, `diff-${viewport}px.png`);
  await writeFile(diffImagePath, PNG.sync.write(diff));

  const totalPixels = width * height;
  const matchPercentage = ((totalPixels - differentPixels) / totalPixels) * 100;

  log.info(
    `${viewport}px: ${matchPercentage.toFixed(1)}% match (${differentPixels}/${totalPixels} different)`
  );

  return {
    viewport,
    totalPixels,
    differentPixels,
    matchPercentage,
    diffImagePath,
  };
}

interface ImageData {
  buffer: Buffer;
  width: number;
  height: number;
}

async function loadAndNormalize(imagePath: string): Promise<ImageData> {
  const metadata = await sharp(imagePath).metadata();
  const buffer = await sharp(imagePath)
    .ensureAlpha()
    .png()
    .toBuffer();

  return {
    buffer,
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

async function padImage(img: ImageData, targetWidth: number, targetHeight: number): Promise<Buffer> {
  if (img.width === targetWidth && img.height === targetHeight) {
    return img.buffer;
  }

  return sharp(img.buffer)
    .resize(targetWidth, targetHeight, {
      fit: "contain",
      position: "top",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
}

function matchFilesByViewport(
  filesA: string[],
  filesB: string[]
): { fileA: string; fileB: string; viewport: number }[] {
  const pairs: { fileA: string; fileB: string; viewport: number }[] = [];
  const vpRegex = /(\d+)px\.png$/;

  const mapB = new Map<number, string>();
  for (const f of filesB) {
    const match = basename(f).match(vpRegex);
    if (match) mapB.set(Number(match[1]), f);
  }

  for (const fA of filesA) {
    const match = basename(fA).match(vpRegex);
    if (!match) continue;
    const vp = Number(match[1]);
    const fB = mapB.get(vp);
    if (fB) {
      pairs.push({ fileA: fA, fileB: fB, viewport: vp });
    }
  }

  return pairs;
}
