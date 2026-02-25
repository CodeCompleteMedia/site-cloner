export interface AssetEntry {
  originalUrl: string;
  localPath: string;
  hashedFilename: string;
  type: "image" | "font" | "svg" | "other";
  mimeType?: string;
  size?: number;
}

export interface AssetManifest {
  baseUrl: string;
  assets: AssetEntry[];
}
