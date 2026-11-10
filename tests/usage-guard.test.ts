import { describe, expect, it } from "vitest";
import { classify, FREE, HARD_CAP, periodStart, STOP, UPLOAD_BUDGET, uploadAllowed, WARN, worstShare } from "../scripts/usage-guard.js";

describe("upload budget", () => {
  it("lets a deploy upload only while the month stays under the budget", () => {
    const limit = FREE.classA * UPLOAD_BUDGET;
    expect(uploadAllowed(0, 188_000)).toBe(true); // the first full upload of the site
    expect(uploadAllowed(limit - 94_000, 94_000)).toBe(true);
    expect(uploadAllowed(limit - 94_000, 94_001)).toBe(false); // one site-wide change too many
    expect(uploadAllowed(limit, 0)).toBe(true); // nothing to upload is always fine
  });

  it("never lets a deploy pass the hard cap, even with a raised budget", () => {
    expect(uploadAllowed(FREE.classA * HARD_CAP - 10, 10, 0.99)).toBe(true);
    expect(uploadAllowed(FREE.classA * HARD_CAP - 10, 11, 0.99)).toBe(false);
    expect(HARD_CAP).toBeLessThan(1);
  });
});

describe("billing period", () => {
  it("counts from Cloudflare's billing day (the 10th), not the 1st of the month", () => {
    expect(periodStart(new Date("2026-11-10T00:00:00Z")).toISOString()).toBe("2026-11-10T00:00:00.000Z");
    expect(periodStart(new Date("2026-11-09T23:59:00Z")).toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(periodStart(new Date("2026-11-01T12:00:00Z")).toISOString()).toBe("2026-10-10T00:00:00.000Z"); // the bug: this was Nov 1
    expect(periodStart(new Date("2027-01-05T08:00:00Z")).toISOString()).toBe("2026-12-10T00:00:00.000Z");
  });
});

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

describe("decide", () => {
  it("takes the site offline only for reads or storage", async () => {
    const { decide } = await import("../scripts/usage-guard.js");
    expect(decide({ classA: 0, classB: 0, storageBytes: 0 })).toBe("OK");
    expect(decide({ classA: FREE.classA * 0.85, classB: 0, storageBytes: 0 })).toBe("WARNING");
    expect(decide({ classA: FREE.classA * 0.99, classB: 0, storageBytes: 0 })).toBe("NO_UPLOADS");
    expect(decide({ classA: 0, classB: FREE.classB * 0.96, storageBytes: 0 })).toBe("STOP");
    expect(decide({ classA: FREE.classA, classB: 0, storageBytes: FREE.storageBytes })).toBe("STOP");
  });
});
