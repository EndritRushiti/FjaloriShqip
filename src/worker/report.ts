/**
 * Reports and suggestions from the site: on a word page a small popup (pick what is wrong, or suggest a
 * description), on the search page "suggest this word". POST /raporto stores each one in a private R2 bucket
 * ("fjalorishqip-raporte", never served to the public), and every Monday the Worker's cron trigger emails
 * the week's list to the author through the contact form's send_email binding, then deletes it.
 *
 * Free-plan limits: at most MAX_PER_WEEK reports are kept a week (a counter object), so even a flood of
 * posts costs only a few thousand R2 writes. Spam protection as for the contact form: a hidden field,
 * a minimum time on the page, length limits.
 */
import { type EmailSender, FROM } from "./contact.js";

/** The parts of the Workers R2 API used here. */
export interface ReportBucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
}

export type ReportKind = "kuptimi" | "pershkrimi" | "lloji" | "fyese" | "sugjerim" | "fjale-e-re";
export interface Report {
  kind: ReportKind;
  word: string;
  /** The visitor's own words: required for a suggestion, optional otherwise. */
  message: string;
  at: string;
}

export const MAX_PER_WEEK = 500;
const MIN_SECONDS = 2;
export const KINDS: Record<ReportKind, string> = {
  kuptimi: "Kuptimi anglisht është i gabuar",
  pershkrimi: "Përshkrimi shqip është i gabuar",
  lloji: "Lloji i fjalës është i gabuar",
  fyese: "Fjalë fyese a e papërshtatshme",
  sugjerim: "Sugjerim për përshkrimin a kuptimin",
  "fjale-e-re": "Fjalë që mungon në fjalor",
};
const NEEDS_TEXT: ReportKind[] = ["sugjerim"];

/** Checks a submitted report; returns it or the reason it was refused. */
export function readReport(form: FormData, now = Date.now()): Report | { error: string } {
  const field = (k: string) => String(form.get(k) ?? "").trim();
  if (field("website")) return { error: "spam" };
  const opened = Number(field("t"));
  if (!opened || now - opened < MIN_SECONDS * 1000) return { error: "too-fast" };
  const kind = field("kind") as ReportKind;
  if (!(kind in KINDS)) return { error: "kind" };
  const word = field("word").slice(0, 100);
  const message = field("message").slice(0, 1000);
  if (!word) return { error: "word" };
  if (NEEDS_TEXT.includes(kind) && message.length < 3) return { error: "message" };
  return { kind, word, message, at: new Date(now).toISOString() };
}

/** Monday of the report's week (UTC), the counter's name: "2026-10-12". */
export function weekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Handles POST /raporto (sent by the page's script; answers JSON). */
export async function handleReport(request: Request, bucket: ReportBucket | undefined, now = new Date()): Promise<Response> {
  const reply = (ok: boolean, error?: string) =>
    new Response(JSON.stringify({ ok, error }), { status: ok ? 200 : 400, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(false, "form");
  }
  const r = readReport(form, now.getTime());
  if ("error" in r) return reply(r.error === "spam", r.error === "spam" ? undefined : r.error); // robots are told it worked
  if (!bucket) return reply(false, "unavailable");
  const counter = `numri/${weekOf(now)}`;
  const count = Number((await (await bucket.get(counter))?.text()) ?? 0);
  if (count >= MAX_PER_WEEK) return reply(false, "full");
  await bucket.put(`r/${r.at}-${Math.random().toString(36).slice(2, 8)}.json`, JSON.stringify(r));
  await bucket.put(counter, String(count + 1));
  return reply(true);
}

const b64 = (s: string) => {
  let bin = "";
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
};
const headerText = (s: string) => `=?UTF-8?B?${b64(s.replace(/[\r\n]+/g, " "))}?=`;
const pageOf = (w: string) => `https://fjalorishqip.org/fjala/${encodeURIComponent(w.replace(/ /g, "_"))}/`;

/** The weekly email: every report grouped by kind, the same word counted once with how often it came. */
export function digest(reports: Report[], to: string, now = new Date(), extra = ""): string {
  const groups = (Object.keys(KINDS) as ReportKind[])
    .map((k) => {
      const list = reports.filter((r) => r.kind === k);
      if (!list.length) return "";
      const byWord = new Map<string, Report[]>();
      for (const r of list) byWord.set(r.word, [...(byWord.get(r.word) ?? []), r]);
      const lines = [...byWord.entries()]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .map(([word, rs]) => {
          const head = `• ${word}${rs.length > 1 ? ` (${rs.length} herë)` : ""}${k === "fjale-e-re" ? "" : ` — ${pageOf(word)}`}`;
          const notes = rs.filter((r) => r.message).map((r) => `  „${r.message.replace(/\s+/g, " ")}”`);
          return [head, ...notes].join("\n");
        });
      return `== ${KINDS[k]} (${list.length}) ==\n\n${lines.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");
  const body = `${extra ? `${extra}\n\n` : ""}Raportet dhe sugjerimet e javës nga fjalorishqip.org: ${reports.length}\n\n${groups}\n\n—\nDërgohet automatikisht çdo të hënë; lista fshihet pas dërgimit.`;
  return [
    `From: ${headerText("FjaloriShqip")} <${FROM}>`,
    `To: <${to}>`,
    `Subject: ${headerText(`FjaloriShqip: ${reports.length} raporte e sugjerime këtë javë`)}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${now.getTime()}.raporte@fjalorishqip.org>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(body).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
}

/** The Monday job: email the stored reports (if any) and delete them, with the old weekly counters. */
/** extra: a line on top of the email (the app and notification numbers, src/worker/push.ts). */
export async function sendWeekly(bucket: ReportBucket | undefined, sender: EmailSender | undefined, to: string | undefined, now = new Date(), extra = ""): Promise<number> {
  if (!bucket || !sender || !to) return 0;
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: "r/", cursor, limit: 1000 });
    keys.push(...page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const reports: Report[] = [];
  for (const k of keys) {
    const text = await (await bucket.get(k))?.text();
    if (text) reports.push(JSON.parse(text) as Report);
  }
  if (reports.length || extra) {
    reports.sort((a, b) => a.at.localeCompare(b.at));
    const { EmailMessage } = (await import("cloudflare:email")) as { EmailMessage: new (from: string, to: string, raw: string) => unknown };
    await sender.send(new EmailMessage(FROM, to, digest(reports, to, now, extra)));
    for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
  }
  const old = (await bucket.list({ prefix: "numri/" })).objects.map((o) => o.key).filter((k) => k < `numri/${weekOf(now)}`);
  if (old.length) await bucket.delete(old);
  return reports.length;
}
