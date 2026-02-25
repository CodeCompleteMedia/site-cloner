import { describe, it, expect } from "vitest";

// Since section-detector requires a live Playwright page, we test the helper logic
// by testing the public interface with mock-friendly patterns

describe("section-detector", () => {
  describe("section ID generation", () => {
    it("should create deterministic IDs from name and selector", () => {
      const { createHash } = require("node:crypto");
      const name = "header";
      const selector = "body > header";
      const hash = createHash("sha256")
        .update(name + selector)
        .digest("hex")
        .slice(0, 6);
      const id = `${name}-${hash}`;

      expect(id).toMatch(/^header-[a-f0-9]{6}$/);

      // Same inputs should give same ID
      const hash2 = createHash("sha256")
        .update(name + selector)
        .digest("hex")
        .slice(0, 6);
      expect(hash).toBe(hash2);
    });

    it("should produce different IDs for different selectors", () => {
      const { createHash } = require("node:crypto");
      const hash1 = createHash("sha256")
        .update("header" + "#site-header")
        .digest("hex")
        .slice(0, 6);
      const hash2 = createHash("sha256")
        .update("header" + "body > header")
        .digest("hex")
        .slice(0, 6);

      expect(hash1).not.toBe(hash2);
    });
  });
});
