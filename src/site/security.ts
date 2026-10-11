/**
 * Security settings shared by the build (scripts/build-site.ts) and the Worker (src/worker/index.ts).
 *
 * HEAD_SCRIPT is the only inline script on the site: it applies the saved language and theme before the
 * page is drawn, so there is no flash. The Content Security Policy allows exactly this script by its
 * SHA-256 hash, so any other inline script (for example one injected through a bug) will not run.
 */
export const HEAD_SCRIPT =
  'try{if(localStorage.getItem("fs-lang")==="en")document.documentElement.classList.add("en");var th=localStorage.getItem("fs-theme");if(th)document.documentElement.setAttribute("data-theme",th)}catch(e){}';

/** Cloudflare Web Analytics: the script it adds to every page, and where that script sends its data. */
const ANALYTICS_SCRIPT = "https://static.cloudflareinsights.com";
const ANALYTICS_CONNECT = "https://cloudflareinsights.com";

/** base64 SHA-256 of a string, in the form CSP expects ("sha256-…"). */
export async function cspHash(source: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return `'sha256-${btoa(bin)}'`;
}

/** The Content Security Policy for every HTML page. */
export function contentSecurityPolicy(headScriptHash: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${headScriptHash} ${ANALYTICS_SCRIPT}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${ANALYTICS_CONNECT}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
