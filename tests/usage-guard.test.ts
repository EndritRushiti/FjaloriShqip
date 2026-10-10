import { describe, expect, it } from "vitest";
import { classify, FREE, STOP, WARN, worstShare } from "../scripts/usage-guard.js";

describe("usage guard", () => {
  it("counts uploads as Class A, reads as Class B and deletes as free", () => {
    expect(
      classify([
        { action: "PutObject", requests: 500 },
        { action: "ListObjects", requests: 50 },
        { action: "GetObject", requests: 9000 },
        { action: "HeadObject", requests: 1000 },
        { action: "DeleteObject", requests: 300 },
      ]),
    ).toEqual({ classA: 550, classB: 10000 });
  });

  it("uses the allowance closest to its limit", () => {
    expect(worstShare({ classA: 0, classB: 0, storageBytes: 0 })).toBe(0);
    expect(worstShare({ classA: FREE.classA * WARN, classB: 10, storageBytes: 10 })).toBeCloseTo(WARN);
    expect(worstShare({ classA: 10, classB: FREE.classB * STOP, storageBytes: 10 })).toBeCloseTo(STOP);
    expect(worstShare({ classA: 10, classB: 10, storageBytes: FREE.storageBytes / 2 })).toBeCloseTo(0.5);
  });
});
