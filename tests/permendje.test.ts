import { describe, expect, it } from "vitest";
import { alertEntries, merge, readme, weekText, type Mention } from "../scripts/permendje.js";

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
    const { all } = merge([], [{ url: "https://bsky.app/profile/a/post/1", title: "@a: fjalorishqip.org", kind: "social", where: "Bluesky" }], "2026-11-29");
    expect(readme(all, [], "2026-11-29")).toContain("## Rrjete sociale (1)");
    expect(weekText(all, ["GitHub"], "2026-11-29")).toContain("1 vende të reja");
    expect(weekText(all, ["GitHub"], "2026-11-29")).toContain("Nuk u arrit: GitHub");
  });
  it("takes the real address out of a Google Alerts entry", () => {
    const xml = `<feed><entry><title type="html">Nj&#39;fjalor i ri: &lt;b&gt;fjalorishqip.org&lt;/b&gt;</title><link href="https://www.google.com/url?rct=j&amp;sa=t&amp;url=https://www.facebook.com/abc/posts/1&amp;ct=ga"/></entry></feed>`;
    expect(alertEntries(xml)).toEqual([{ url: "https://www.facebook.com/abc/posts/1", title: "Nj'fjalor i ri: fjalorishqip.org" }]);
  });
  it("puts in the email only what was found in the last 7 days", () => {
    const m = (url: string, firstSeen: string): Mention => ({ url, title: url, kind: "web", where: "x", firstSeen, lastSeen: firstSeen });
    const text = weekText([m("https://a.al/", "2026-11-29"), m("https://b.al/", "2026-11-10")], [], "2026-11-29");
    expect(text).toContain("https://a.al/");
    expect(text).not.toContain("https://b.al/");
  });
});
