export interface ExtractConfig {
  url: string;
  outputDir: string;
  viewports: number[];
  waitForNetworkIdle: boolean;
  scrollForLazyContent: boolean;
  timeout: number;
}

export interface ScreenshotConfig {
  url: string;
  outputDir: string;
  viewports: number[];
  fullPage: boolean;
  scrollForLazyContent: boolean;
  timeout: number;
}

export interface DiffConfig {
  dirA: string;
  dirB: string;
  outputDir: string;
  threshold: number;
  antialiased: boolean;
}

export interface AssetsConfig {
  extractionDir: string;
  concurrency: number;
  retries: number;
  timeout: number;
}

export const DEFAULT_VIEWPORTS = [375, 768, 1440];
export const DEFAULT_PASS_THRESHOLD = 90;
