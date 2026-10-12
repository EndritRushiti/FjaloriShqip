import { describe, expect, it } from "vitest";
import { mime, readForm } from "../src/worker/contact.js";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const now = 1_800_000_000_000;
const ok = { name: "Ana", email: "ana@example.org", message: "Përshëndetje, një fjalë mungon.", t: String(now - 10_000) };

describe("contact form", () => {
  it("accepts a normal message", () => {
    expect(readForm(form(ok), now)).toEqual({ name: "Ana", email: "ana@example.org", message: "Përshëndetje, një fjalë mungon." });
  });
  it("refuses robots, instant posts and bad addresses", () => {
    expect(readForm(form({ ...ok, website: "spam.example" }), now)).toEqual({ error: "spam" });
    expect(readForm(form({ ...ok, t: String(now - 500) }), now)).toEqual({ error: "too-fast" });
    expect(readForm(form({ ...ok, email: "not an address" }), now)).toEqual({ error: "email" });
    expect(readForm(form({ ...ok, message: "hi" }), now)).toEqual({ error: "message" });
  });
  it("builds a UTF-8 email that replies to the visitor", () => {
    const raw = mime({ name: "Ana", email: "ana@example.org", message: "ë ç" }, "me@example.org", new Date(now));
    expect(raw).toContain("Reply-To: <ana@example.org>");
    expect(raw).toContain("To: <me@example.org>");
    expect(raw).toContain("Content-Type: text/plain; charset=utf-8");
    const body = raw.split("\r\n\r\n")[1].replace(/\r\n/g, "");
    expect(new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)))).toContain("ë ç");
  });
});
