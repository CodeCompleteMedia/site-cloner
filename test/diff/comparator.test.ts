import { describe, it, expect } from "vitest";
import { classifySeverity } from "../../src/diff/section-scorer.js";

describe("section-scorer", () => {
  describe("classifySeverity", () => {
    it("should classify >=95% as pass", () => {
      expect(classifySeverity(100)).toBe("pass");
      expect(classifySeverity(95)).toBe("pass");
      expect(classifySeverity(99.9)).toBe("pass");
    });

    it("should classify 85-94.9% as minor", () => {
      expect(classifySeverity(85)).toBe("minor");
      expect(classifySeverity(90)).toBe("minor");
      expect(classifySeverity(94.9)).toBe("minor");
    });

    it("should classify 70-84.9% as major", () => {
      expect(classifySeverity(70)).toBe("major");
      expect(classifySeverity(75)).toBe("major");
      expect(classifySeverity(84.9)).toBe("major");
    });

    it("should classify <70% as critical", () => {
      expect(classifySeverity(69.9)).toBe("critical");
      expect(classifySeverity(50)).toBe("critical");
      expect(classifySeverity(0)).toBe("critical");
    });
  });
});
