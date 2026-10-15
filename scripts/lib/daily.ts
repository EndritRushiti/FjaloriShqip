/**
 * The daily notifications and the calendar: which dialect word and which proverb belong to which day.
 *
 * Word of the day: a dialect form of a common standard word, explained through that word
 * (Gegërisht "gurënue" → "gurëzoj": …), so the reader learns a dialect word with a meaning they already know.
 * Proverb of the day: the proverbs of the dictionary with their Albanian explanation.
 *
 * Each list is shuffled once in a fixed order (by a hash of the word), and day n of the calendar takes
 * item n mod length: the same day always shows the same word while the lists stay the same.
 */

export interface DailyItem {
  /** notification title */
  titulli: string;
  /** notification text */
  teksti: string;
  /** page on the site */
  url: string;
}
export interface DailyDay {
  fjala: DailyItem;
  fjaleUrte: DailyItem;
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A fixed shuffle: sorted by a hash of each item's key. */
export const shuffled = <T>(items: T[], key: (x: T) => string): T[] => [...items].sort((a, b) => hash(key(a)) - hash(key(b)) || key(a).localeCompare(key(b)));

/** Days since 1970-01-01 of a "YYYY-MM-DD" date. */
export const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86400000);

/** "YYYY-MM-DD" a number of days after a date. */
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Today's date in Albania. */
export function todayInAlbania(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tirane", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function dayOf<T>(list: T[], date: string): T {
  return list[((dayNumber(date) % list.length) + list.length) % list.length];
}

// ── calendar (.ics) ──
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 bytes are folded (RFC 5545), without cutting a UTF-8 letter in two. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function calendar(days: [string, DailyDay][], site: string, stamp: Date): string {
  const dt = (d: string) => d.replace(/-/g, "");
  const now = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FjaloriShqip//Fjala e ditës//SQ",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:FjaloriShqip — Fjala e ditës",
    "X-WR-CALDESC:Çdo ditë një fjalë dialektore dhe një fjalë e urtë shqipe nga fjalorishqip.org",
    "X-WR-TIMEZONE:Europe/Tirane",
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
  ];
  for (const [date, d] of days) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${date}@fjalorishqip.org`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dt(date)}`,
      `DTEND;VALUE=DATE:${dt(addDays(date, 1))}`,
      `SUMMARY:${icsText(d.fjala.titulli)}`,
      `DESCRIPTION:${icsText(`${d.fjala.teksti}\n${site}${d.fjala.url}\n\n${d.fjaleUrte.titulli}: ${d.fjaleUrte.teksti}\n${site}${d.fjaleUrte.url}`)}`,
      `URL:${site}${d.fjala.url}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
