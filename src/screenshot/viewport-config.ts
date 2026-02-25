export interface ViewportPreset {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORT_PRESETS: Record<string, ViewportPreset> = {
  mobile: { name: "Mobile", width: 375, height: 812 },
  tablet: { name: "Tablet", width: 768, height: 1024 },
  desktop: { name: "Desktop", width: 1440, height: 900 },
  "desktop-hd": { name: "Desktop HD", width: 1920, height: 1080 },
};

export function resolveViewports(input: string): number[] {
  return input.split(",").map((v) => {
    const trimmed = v.trim();
    const preset = VIEWPORT_PRESETS[trimmed.toLowerCase()];
    if (preset) return preset.width;
    const num = Number(trimmed);
    if (isNaN(num) || num < 200 || num > 3840) {
      throw new Error(`Invalid viewport: ${trimmed}. Use a number (200-3840) or preset name (mobile, tablet, desktop).`);
    }
    return num;
  });
}
