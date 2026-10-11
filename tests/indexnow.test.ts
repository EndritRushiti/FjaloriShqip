import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { changedPages, KEY } from "../scripts/indexnow.js";

describe("IndexNow", () => {
  it("turns uploaded pages from rclone's log into site URLs", () => {
    const log = [
      "2026/10/11 12:00:01 INFO  : fjala/nënë/index.html: Copied (replaced existing)",
      "2026/10/11 12:00:01 INFO  : index.html: Copied (replaced existing)",
      "2026/10/11 12:00:02 INFO  : shkronja/a/2/index.html: Copied (new)",
      "2026/10/11 12:00:02 INFO  : api/v1/fjala/nënë.json: Copied (replaced existing)",
      "2026/10/11 12:00:02 INFO  : style.css: Copied (replaced existing)",
      "2026/10/11 12:00:03 INFO  : 404.html: Copied (replaced existing)",
      "2026/10/11 12:00:03 INFO  : kerko/index.html: Copied (replaced existing)",
      "2026/10/11 12:00:04 INFO  : fjala/vjetër/index.html: Deleted",
    ].join("\n");
    expect(changedPages(log, "https://example.org")).toEqual([
      "https://example.org/fjala/n%C3%ABn%C3%AB/",
      "https://example.org/",
      "https://example.org/shkronja/a/2/",
    ]);
  });

  it("has its key file in public/", () => {
    expect(fs.readFileSync(`public/${KEY}.txt`, "utf8")).toBe(KEY);
  });
});
