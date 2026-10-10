/**
 * Checks this month's R2 usage against the free allowance, so the site never runs into paid usage.
 *
 *   npx tsx scripts/usage-guard.ts
 *
 * Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (the token needs "Account Analytics: Read").
 * Exit code: 0 = fine, 1 = warning (≥ WARN of an allowance used), 2 = stop (≥ STOP used), 3 = could not check.
 * The workflow .github/workflows/usage-guard.yml takes the site offline on exit code 2.
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** Cloudflare's free R2 allowance per month (Standard storage class). */
export const FREE = { classA: 1_000_000, classB: 10_000_000, storageBytes: 10 * 1e9 };
export const WARN = 0.8;
export const STOP = 0.95;

// R2 pricing: which operations are billed as Class A or Class B (the rest, like deletes, are free)
const CLASS_A = new Set([
  "ListBuckets", "PutBucket", "ListObjects", "ListObjectsV2", "PutObject", "CopyObject", "CompleteMultipartUpload",
  "CreateMultipartUpload", "UploadPart", "UploadPartCopy", "ListMultipartUploads", "ListParts", "PutBucketEncryption",
  "PutBucketCors", "PutBucketLifecycleConfiguration", "LifecycleStorageTierTransition",
]);
const CLASS_B = new Set([
  "HeadBucket", "HeadObject", "GetObject", "UsageSummary", "GetBucketEncryption", "GetBucketLocation", "GetBucketCors",
  "GetBucketLifecycleConfiguration",
]);

export interface Usage {
  classA: number;
  classB: number;
  storageBytes: number;
}

export function classify(rows: { action: string; requests: number }[]): Pick<Usage, "classA" | "classB"> {
  let classA = 0;
  let classB = 0;
  for (const r of rows) {
    if (CLASS_A.has(r.action)) classA += r.requests;
    else if (CLASS_B.has(r.action)) classB += r.requests;
  }
  return { classA, classB };
}

/** The highest share of any free allowance used so far (0.5 = half). */
export function worstShare(u: Usage): number {
  return Math.max(u.classA / FREE.classA, u.classB / FREE.classB, u.storageBytes / FREE.storageBytes);
}

const QUERY = `query ($account: String!, $start: Time!, $end: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    ops: r2OperationsAdaptiveGroups(limit: 1000, filter: { datetime_geq: $start, datetime_leq: $end }) {
      sum { requests } dimensions { actionType }
    }
    storage: r2StorageAdaptiveGroups(limit: 1000, filter: { datetime_geq: $start, datetime_leq: $end }) {
      max { payloadSize metadataSize } dimensions { bucketName }
    }
  } }
}`;

interface GraphqlResult {
  data?: { viewer: { accounts: {
    ops: { sum: { requests: number }; dimensions: { actionType: string } }[];
    storage: { max: { payloadSize: number; metadataSize: number }; dimensions: { bucketName: string } }[];
  }[] } };
  errors?: { message: string }[];
}

export async function fetchUsage(account: string, token: string, now = new Date()): Promise<Usage> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { account, start, end: now.toISOString() } }),
  });
  const json = (await res.json()) as GraphqlResult;
  if (!res.ok || json.errors?.length || !json.data) {
    throw new Error(`Cloudflare analytics: ${res.status} ${json.errors?.map((e) => e.message).join("; ") ?? ""}`);
  }
  const acc = json.data.viewer.accounts[0];
  if (!acc) throw new Error("Cloudflare analytics: account not found (check CLOUDFLARE_ACCOUNT_ID)");
  const ops = classify(acc.ops.map((r) => ({ action: r.dimensions.actionType, requests: r.sum.requests })));
  const storageBytes = acc.storage.reduce((s, r) => s + r.max.payloadSize + r.max.metadataSize, 0);
  return { ...ops, storageBytes };
}

function pct(n: number, of: number) {
  return `${((n / of) * 100).toFixed(1)}%`;
}

async function main() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are needed");
  const u = await fetchUsage(account, token);
  const share = worstShare(u);
  const status = share >= STOP ? "STOP" : share >= WARN ? "WARNING" : "OK";
  const report = [
    `## R2 usage this month: ${status}`,
    "",
    "| | Used | Free each month | Share |",
    "|---|---|---|---|",
    `| Class A (uploads, lists) | ${u.classA.toLocaleString("en")} | ${FREE.classA.toLocaleString("en")} | ${pct(u.classA, FREE.classA)} |`,
    `| Class B (reads) | ${u.classB.toLocaleString("en")} | ${FREE.classB.toLocaleString("en")} | ${pct(u.classB, FREE.classB)} |`,
    `| Storage | ${(u.storageBytes / 1e9).toFixed(2)} GB | ${FREE.storageBytes / 1e9} GB | ${pct(u.storageBytes, FREE.storageBytes)} |`,
    "",
    `Warning at ${WARN * 100}%, site goes offline at ${STOP * 100}% of any allowance.`,
  ].join("\n");
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=${status}\n`);
  process.exitCode = status === "STOP" ? 2 : status === "WARNING" ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 3;
  });
}
