import type { ExtractionResult, DiscoveredRoute } from "../types/extraction.js";

export interface RouteMapping {
  path: string;
  label?: string;
  isExternal: boolean;
}

export interface FrameworkRouteMap {
  urlPath: string;
  filePath: string;
  componentName: string;
}

export interface FrameworkGenerator {
  readonly name: string;
  readonly displayName: string;

  /** Scaffold a new project with the framework's structure */
  scaffold(outputDir: string, extraction: ExtractionResult): Promise<void>;

  /** Generate a tokens/theme CSS file from extracted design tokens */
  generateTokens(outputDir: string, extraction: ExtractionResult): Promise<string>;

  /** Map discovered routes to framework-specific file routes */
  mapRoutes(routes: RouteMapping[]): FrameworkRouteMap[];

  /** Get the dev server start command */
  getDevCommand(): string;

  /** Get the dev server URL */
  getDevUrl(port?: number): string;
}
