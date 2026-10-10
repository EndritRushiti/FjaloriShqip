import { describe, expect, it } from "vitest";
import worker, { keyFor, type Env, type R2Bucket } from "../src/worker/index.js";

function bucket(files: Record<string, string>): R2Bucket {
  return {
    async get(key) {
      if (!(key in files)) return null;
      return { body: new Response(files[key]).body!, httpEtag: `"${key.length}"`, size: files[key].length };
    },
    async head(key) {
      return key in files ? {} : null;
    },
  };
}

const env: Env = {
  SITE: bucket({
    "index.html": "<h1>home</h1>",
    "404.html": "<h1>404</h1>",
    "fjala/nënë/index.html": "<h1>nënë</h1>",
    "api/v1/fjala/nënë.json": '{"word":"nënë"}',
    "style.css": "body{}",
  }),
  NOINDEX: "1",
};

const get = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://example.org${path}`, init), env);

describe("worker", () => {
  it("maps paths to bucket keys", () => {
    expect(keyFor("/")).toBe("index.html");
    expect(keyFor("/fjala/n%C3%ABn%C3%AB/")).toBe("fjala/nënë/index.html");
    expect(keyFor("/style.css")).toBe("style.css");
    expect(keyFor("/a/../secret")).toBeNull();
    expect(keyFor("/%E0%A4%A")).toBeNull();
  });

  it("serves the home page and word pages", async () => {
    const home = await get("/");
    expect(home.status).toBe(200);
    expect(home.headers.get("Content-Type")).toContain("text/html");
    expect(home.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await (await get("/fjala/n%C3%ABn%C3%AB/")).text()).toBe("<h1>nënë</h1>");
  });

  it("redirects a page path without the trailing slash", async () => {
    const res = await get("/fjala/n%C3%ABn%C3%AB");
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.org/fjala/n%C3%ABn%C3%AB/");
  });

  it("serves the API with CORS and an hour of caching", async () => {
    const res = await get("/api/v1/fjala/n%C3%ABn%C3%AB.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(await res.json()).toEqual({ word: "nënë" });
  });

  it("returns the 404 page for missing files", async () => {
    const res = await get("/fjala/nuk-ekziston/");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("<h1>404</h1>");
  });

  it("answers 304 when the browser already has the file", async () => {
    const first = await get("/style.css");
    const again = await get("/style.css", { headers: { "If-None-Match": first.headers.get("ETag")! } });
    expect(again.status).toBe(304);
  });

  it("redirects www to the main address", async () => {
    const res = await worker.fetch(new Request("https://www.fjalorishqip.org/fjala/n%C3%ABn%C3%AB/?q=1"), {
      ...env,
      CANONICAL_HOST: "fjalorishqip.org",
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://fjalorishqip.org/fjala/n%C3%ABn%C3%AB/?q=1");
  });

  it("serves the offline page without touching the bucket", async () => {
    const empty: R2Bucket = {
      get: () => Promise.reject(new Error("bucket read while offline")),
      head: () => Promise.reject(new Error("bucket read while offline")),
    };
    const res = await worker.fetch(new Request("https://example.org/fjala/n%C3%ABn%C3%AB/"), { SITE: empty, OFFLINE: "1" });
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("përkohësisht jashtë funksionit");
  });

  it("only allows reading", async () => {
    expect((await get("/", { method: "POST" })).status).toBe(405);
    expect((await get("/", { method: "HEAD" })).status).toBe(200);
  });
});
