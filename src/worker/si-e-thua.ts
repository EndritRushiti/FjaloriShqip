/**
 * "Si e thua ti?": on every word page a visitor gives their own form of the word, with dialect and region.
 *
 *   POST /si-e-thua  → stores one answer
 *   GET  /si-e-thua  → the forms that reached the threshold (no personal data); read by the Sunday job,
 *                      .github/workflows/si-e-thua.yml, which checks them with scripts/si-e-thua.ts
 *
 * One small object per word and dialect in the private bucket, holding each person's answer under a key made
 * from a salted hash of their connection, so the same person can never count twice for the same word: a second
 * answer replaces the first. The address itself is never stored, the salt is random and stays in the bucket.
 * A person is one connection, so people at home on the same line count once: that errs on the safe side.
 *
 * Free-plan limits: MAX_PER_WEEK answers a week and MAX_PER_DAY for one person, each a few R2 writes.
 * Spam protection as for reports: a hidden field, a minimum time on the page, length limits.
 */
import type { ReportBucket } from "./report.js";
import { weekOf } from "./report.js";

export const DIALECTS = ["gheg", "tosk", "arberesh", "arvanitika"] as const;
export type DialectId = (typeof DIALECTS)[number];

/** How many different people must give the same form for the same dialect. */
export const NEEDED = 3;
export const MAX_PER_WEEK = 3000;
export const MAX_PER_DAY = 40;
const MIN_SECONDS = 2;
const READY = "d-gati.json";

export interface Answer {
  word: string;
  form: string;
  dialect: DialectId;
  region: string;
}
/** One word in one dialect: each person's answer. */
export interface Record_ {
  word: string;
  dialect: DialectId;
  votes: Record<string, { form: string; region: string }>;
}
/** A form that reached the threshold. */
export interface Ready {
  word: string;
  dialect: DialectId;
  form: string;
  count: number;
  regions: string[];
}

/** Forms that differ only in capitals, ë or ç are the same answer. */
export const fold = (s: string) =>
  s.normalize("NFC").toLowerCase().replace(/ë/g, "e").replace(/ç/g, "c").replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();

/** Checks a submitted answer; returns it or the reason it was refused. */
export function readAnswer(form: FormData, now = Date.now()): Answer | { error: string } {
  const field = (k: string) => String(form.get(k) ?? "").trim();
  if (field("website")) return { error: "spam" };
  const opened = Number(field("t"));
  if (!opened || now - opened < MIN_SECONDS * 1000) return { error: "too-fast" };
  const word = field("word").slice(0, 100);
  const said = field("form").normalize("NFC").toLowerCase().replace(/\s+/g, " ");
  const dialect = field("dialect") as DialectId;
  const region = field("region").slice(0, 60);
  if (!word) return { error: "word" };
  if (said.length < 2 || said.length > 40) return { error: "form" };
  if (!DIALECTS.includes(dialect)) return { error: "dialect" };
  return { word, form: said, dialect, region };
}

async function sha(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The same connection always gives the same short id; the id cannot be turned back into the address. */
async function personId(request: Request, bucket: ReportBucket): Promise<string> {
  let salt = await (await bucket.get("d-krip"))?.text();
  if (!salt) {
    salt = await sha(`${Math.random()}${Date.now()}${Math.random()}`);
    await bucket.put("d-krip", salt);
  }
  const address = request.headers.get("CF-Connecting-IP") ?? "";
  return (await sha(`${salt}|${address}`)).slice(0, 16);
}

/** Forms of one word and dialect with how many people gave each; the spelling most people used is kept. */
export function tally(rec: Record_): Ready[] {
  const groups = new Map<string, { spelling: Map<string, number>; regions: Set<string>; count: number }>();
  for (const v of Object.values(rec.votes)) {
    const k = fold(v.form);
    const g = groups.get(k) ?? { spelling: new Map(), regions: new Set(), count: 0 };
    g.count++;
    g.spelling.set(v.form, (g.spelling.get(v.form) ?? 0) + 1);
    if (v.region) g.regions.add(v.region);
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => ({
    word: rec.word,
    dialect: rec.dialect,
    form: [...g.spelling.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    count: g.count,
    regions: [...g.regions].sort(),
  }));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/** Handles POST and GET /si-e-thua (sent by the page's script; answers JSON). */
export async function handleSiThua(request: Request, bucket: ReportBucket | undefined, now = new Date()): Promise<Response> {
  if (request.method === "GET") {
    if (!bucket) return json([]);
    return new Response((await (await bucket.get(READY))?.text()) ?? "[]", { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "form" }, 400);
  }
  const a = readAnswer(form, now.getTime());
  if ("error" in a) return a.error === "spam" ? json({ ok: true }) : json({ ok: false, error: a.error }, 400); // robots are told it worked
  if (!bucket) return json({ ok: false, error: "unavailable" }, 400);

  const week = `d-numri/${weekOf(now)}`;
  const weekCount = Number((await (await bucket.get(week))?.text()) ?? 0);
  if (weekCount >= MAX_PER_WEEK) return json({ ok: false, error: "full" }, 400);
  const person = await personId(request, bucket);
  const day = `d-dita/${now.toISOString().slice(0, 10)}/${person}`;
  const dayCount = Number((await (await bucket.get(day))?.text()) ?? 0);
  if (dayCount >= MAX_PER_DAY) return json({ ok: false, error: "full" }, 400);

  const key = `d/${(await sha(`${a.word}|${a.dialect}`)).slice(0, 32)}.json`;
  const text = await (await bucket.get(key))?.text();
  const rec: Record_ = text ? (JSON.parse(text) as Record_) : { word: a.word, dialect: a.dialect, votes: {} };
  rec.votes[person] = { form: a.form, region: a.region };
  await bucket.put(key, JSON.stringify(rec));
  await bucket.put(week, String(weekCount + 1));
  await bucket.put(day, String(dayCount + 1));

  const passed = tally(rec).filter((r) => r.count >= NEEDED);
  if (passed.length) {
    const ready = JSON.parse((await (await bucket.get(READY))?.text()) ?? "[]") as Ready[];
    const others = ready.filter((r) => !(r.word === a.word && r.dialect === a.dialect));
    await bucket.put(READY, JSON.stringify([...others, ...passed]));
  }
  return json({ ok: true });
}
