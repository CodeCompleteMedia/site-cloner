import { createHash } from "node:crypto";

export function hashContent(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

export function hashString(str: string): string {
  return createHash("sha256").update(str, "utf-8").digest("hex").slice(0, 12);
}
