import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { resolve } from "pathe";
import { writeFile } from "node:fs/promises";
import { createScopedLogger } from "../utils/logger.js";
import type { SectionScore } from "../types/diff.js";
import type { BoundingBox } from "../types/extraction.js";

const log = createScopedLogger("section-scorer");

export function classifySeverity(matchPercentage: number): SectionScore["severity"] {
  if (matchPercentage >= 95) return "pass";
  if (matchPercentage >= 85) return "minor";
  if (matchPercentage >= 70) return "major";
  return "critical";
}

export async function scoreSections(
  imageA: string,
  imageB: string,
  sections: { id: string; name: string; boundingBox: BoundingBox }[],
  viewport: number,
  outputDir: string
): Promise<SectionScore[]> {
  const scores: SectionScore[] = [];

  for (const section of sections) {
    const { boundingBox } = section;

    // Skip sections with zero dimensions
    if (boundingBox.width <= 0 || boundingBox.height <= 0) continue;

    try {
      const [cropA, cropB] = await Promise.all([
        cropRegion(imageA, boundingBox),
        cropRegion(imageB, boundingBox),
      ]);

      if (!cropA || !cropB) {
        log.warn(`Could not crop section ${section.name} at ${viewport}px`);
        continue;
      }

      const width = cropA.width;
      const height = cropA.height;

      const pngA = PNG.sync.read(cropA.buffer);
      const pngB = PNG.sync.read(cropB.buffer);

      const diff = new PNG({ width, height });
      const differentPixels = pixelmatch(
        pngA.data,
        pngB.data,
        diff.data,
        width,
        height,
        { threshold: 0.1, includeAA: false }
      );

      const totalPixels = width * height;
      const matchPercentage = ((totalPixels - differentPixels) / totalPixels) * 100;
      const severity = classifySeverity(matchPercentage);

      const diffImagePath = resolve(outputDir, `section-${section.id}-${viewport}px-diff.png`);
      await writeFile(diffImagePath, PNG.sync.write(diff));

      scores.push({
        sectionId: section.id,
        sectionName: section.name,
        viewport,
        matchPercentage,
        severity,
        diffImagePath,
      });

      log.info(`Section ${section.name} (${viewport}px): ${matchPercentage.toFixed(1)}% [${severity}]`);
    } catch (err) {
      log.warn(`Error scoring section ${section.name}: ${(err as Error).message}`);
    }
  }

  return scores;
}

async function cropRegion(
  imagePath: string,
  box: BoundingBox
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    const metadata = await sharp(imagePath).metadata();
    const imgWidth = metadata.width || 0;
    const imgHeight = metadata.height || 0;

    // Clamp to image bounds
    const left = Math.max(0, Math.min(box.x, imgWidth - 1));
    const top = Math.max(0, Math.min(box.y, imgHeight - 1));
    const width = Math.min(box.width, imgWidth - left);
    const height = Math.min(box.height, imgHeight - top);

    if (width <= 0 || height <= 0) return null;

    const buffer = await sharp(imagePath)
      .extract({ left, top, width, height })
      .ensureAlpha()
      .png()
      .toBuffer();

    return { buffer, width, height };
  } catch {
    return null;
  }
}
