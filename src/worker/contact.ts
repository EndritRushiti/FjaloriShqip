/**
 * The contact form on /rreth/: POST /kontakt → an email to the author, sent through Cloudflare Email Routing.
 * The destination address is never in the page or in the repository: the deploy workflow adds the
 * send_email binding from a GitHub secret (CONTACT_EMAIL).
 *
 * Spam protection: a hidden field that people leave empty, a minimum time between opening the page and
 * sending, length limits, and the zone's rate-limiting rule.
 */

/** The send_email binding of the Workers runtime (kept local so the repo needs no Workers type package). */
export interface EmailSender {
  send(message: unknown): Promise<void>;
}

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

/** Sender address on our own domain (Email Routing only sends from the zone). */
export const FROM = "kontakt@fjalorishqip.org";
const MIN_SECONDS = 3;

/** Checks a submitted form; returns the message or the reason it was refused. */
export function readForm(form: FormData, now = Date.now()): ContactMessage | { error: string } {
  const field = (k: string) => String(form.get(k) ?? "").trim();
  if (field("website")) return { error: "spam" }; // the hidden field: only robots fill it in
  const opened = Number(field("t"));
  if (!opened || now - opened < MIN_SECONDS * 1000) return { error: "too-fast" };
  const name = field("name").slice(0, 100);
  const email = field("email").slice(0, 200);
  const message = field("message");
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return { error: "email" };
  if (message.length < 5 || message.length > 5000) return { error: "message" };
  return { name, email, message };
}

const b64 = (s: string) => {
  let bin = "";
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
};
/** Header text with non-ASCII letters (ë, ç) encoded as RFC 2047. */
const headerText = (s: string) => `=?UTF-8?B?${b64(s.replace(/[\r\n]+/g, " "))}?=`;

/** The raw email (MIME) for one message. */
export function mime(m: ContactMessage, to: string, now = new Date()): string {
  const body = `${m.message}\n\n—\n${m.name || "(pa emër)"} <${m.email}>\nDërguar nga forma e kontaktit në fjalorishqip.org`;
  return [
    `From: ${headerText("FjaloriShqip")} <${FROM}>`,
    `To: <${to}>`,
    `Reply-To: <${m.email}>`,
    `Subject: ${headerText(`FjaloriShqip: mesazh nga ${m.name || m.email}`)}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${now.getTime()}.${Math.random().toString(36).slice(2)}@fjalorishqip.org>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(body).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
}

/** Handles POST /kontakt. Answers JSON for the page's script, or redirects back for a plain form post. */
export async function handleContact(request: Request, sender: EmailSender | undefined, to: string | undefined): Promise<Response> {
  const json = (request.headers.get("Accept") ?? "").includes("application/json");
  const reply = (ok: boolean, error?: string) =>
    json
      ? new Response(JSON.stringify({ ok, error }), { status: ok ? 200 : 400, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } })
      : Response.redirect(new URL(`/rreth/?kontakt=${ok ? "ok" : "gabim"}#kontakt`, request.url).toString(), 303);
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(false, "form");
  }
  const m = readForm(form);
  if ("error" in m) return reply(m.error === "spam", m.error === "spam" ? undefined : m.error); // robots are told it worked
  if (!sender || !to) return reply(false, "unavailable");
  // the runtime's EmailMessage class; imported here so tests can run the rest without the Workers runtime
  const { EmailMessage } = (await import("cloudflare:email")) as { EmailMessage: new (from: string, to: string, raw: string) => unknown };
  try {
    await sender.send(new EmailMessage(FROM, to, mime(m, to)));
  } catch {
    return reply(false, "send");
  }
  return reply(true);
}
