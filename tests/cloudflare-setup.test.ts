import { describe, expect, it } from "vitest";
import { rules } from "../scripts/cloudflare-setup.js";

describe("cloudflare setup rules", () => {
  it("covers every phase the Worker used to handle, within the free plan's 10 rules per phase", async () => {
    const r = await rules();
    expect(Object.keys(r).sort()).toEqual([
      "http_request_cache_settings",
      "http_request_transform",
      "http_response_headers_transform",
    ]);
    for (const list of Object.values(r)) expect(list.length).toBeLessThanOrEqual(10);
  });

  it("only touches the main domain", async () => {
    for (const list of Object.values(await rules())) for (const rule of list) expect(rule.expression).toContain('http.host eq "fjalorishqip.org"');
  });

  it("sends the page CSP with the hash of the inline head script", async () => {
    const headers = (await rules()).http_response_headers_transform[0].action_parameters.headers as Record<string, { value: string }>;
    expect(headers["Content-Security-Policy"].value).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
    expect(headers["Strict-Transport-Security"].value).toContain("max-age=31536000");
  });
});
