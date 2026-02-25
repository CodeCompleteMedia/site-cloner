export interface PixelDiffResult {
  viewport: number;
  totalPixels: number;
  differentPixels: number;
  matchPercentage: number;
  diffImagePath: string;
}

export interface SectionScore {
  sectionId: string;
  sectionName: string;
  viewport: number;
  matchPercentage: number;
  severity: "pass" | "minor" | "major" | "critical";
  diffImagePath?: string;
}

export interface DiffResult {
  timestamp: string;
  sourceA: string;
  sourceB: string;
  overallScores: PixelDiffResult[];
  sectionScores: SectionScore[];
  passed: boolean;
  passThreshold: number;
}
