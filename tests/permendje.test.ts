import { describe, expect, it } from "vitest";
import { merge, readme, weekText, type Mention } from "../scripts/permendje.js";

describe("permendje", () => {
  const old: Mention[] = [{ url: "https://sq.wikipedia.org/wiki/Gjuha_shqipe", title: "Gjuha shqipe", kind: "wikipedia", where: "sq.wikipedia.org", firstSeen: "2026-11-22", lastSeen: "2026-11-22" }];
  it("keeps the first date of a known place and dates a new one today", () => {
    const { all, fresh } = merge(old, [
      { url: "https://sq.wikipedia.org/wiki/Gjuha_shqipe", title: "Gjuha shqipe", kind: "wikipedia", where: "sq.wikipedia.org" },
      { url: "https://github.com/x/y", title: "x/y", kind: "github", where: "github: projekt" },
    ], "2026-11-29");
    expect(fresh.map((m) => m.url)).toEqual(["https://github.com/x/y"]);
    expect(all.find((m) => m.kind === "wikipedia")).toMatchObject({ firstSeen: "2026-11-22", lastSeen: "2026-11-29" });
  });
  it("writes the list and the email part in Albanian", () => {
    const { all, fresh } = merge([], [{ url: "https://bsky.app/profile/a/post/1", title: "@a: fjalorishqip.org", kind: "social", where: "Bluesky" }], "2026-11-29");
    expect(readme(all, [], "2026-11-29")).toContain("## Rrjete sociale (1)");
    expect(weekText(fresh, all, ["GitHub"], "2026-11-29")).toContain("1 vende të reja");
    expect(weekText(fresh, all, ["GitHub"], "2026-11-29")).toContain("Nuk u arrit: GitHub");
  });
});
