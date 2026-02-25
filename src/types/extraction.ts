export interface ExtractionMeta {
  url: string;
  title: string;
  description: string;
  extractedAt: string;
  viewports: ViewportWidth[];
  iconLibraries: IconLibrary[];
  routes: DiscoveredRoute[];
}

export type ViewportWidth = number;

export interface DiscoveredRoute {
  path: string;
  label?: string;
  isExternal: boolean;
}

export interface IconLibrary {
  name: string;
  detectedBy: "class-prefix" | "font-family" | "svg-sprite" | "cdn-url";
  cdnUrl?: string;
  prefix?: string;
}

export interface CSSVariable {
  name: string;
  value: string;
  scope: string;
}

export interface FontInfo {
  family: string;
  weights: string[];
  styles: string[];
  src?: string[];
}

export interface DesignTokens {
  cssVariables: CSSVariable[];
  fonts: FontInfo[];
  colors: string[];
  spacingValues: number[];
}

export interface DOMNode {
  tag: string;
  id?: string;
  classNames: string[];
  attributes: Record<string, string>;
  computedStyles: Record<string, string>;
  boundingBox: BoundingBox;
  children: DOMNode[];
  textContent?: string;
  /** Only styles that differ from parent (deduplication) */
  uniqueStyles?: Record<string, string>;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageSection {
  id: string;
  name: string;
  landmark: string;
  boundingBox: BoundingBox;
  dom: DOMNode;
  matchedCSS: string;
  viewport: ViewportWidth;
}

export interface ExtractionResult {
  meta: ExtractionMeta;
  tokens: DesignTokens;
  sections: PageSection[];
  assetManifest: import("./assets.js").AssetManifest;
}
