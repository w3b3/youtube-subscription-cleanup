import { db } from "./db.js";

const DAILY_BUDGET = 10_000;
const KEY_DATE = "quota_date_pt";
const KEY_USED = "quota_used";

function todayPT(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function getMeta(key: string): string | null {
  const row = db.prepare("SELECT value FROM app_meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function setMeta(key: string, value: string) {
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

function rolloverIfNeeded() {
  const today = todayPT();
  if (getMeta(KEY_DATE) !== today) {
    setMeta(KEY_DATE, today);
    setMeta(KEY_USED, "0");
  }
}

export function recordQuota(units: number) {
  rolloverIfNeeded();
  const used = Number(getMeta(KEY_USED) ?? "0") + units;
  setMeta(KEY_USED, String(used));
}

export function quotaUsedToday(): number {
  rolloverIfNeeded();
  return Number(getMeta(KEY_USED) ?? "0");
}

export function quotaRemainingEstimate(): number {
  return Math.max(0, DAILY_BUDGET - quotaUsedToday());
}

export const QUOTA_COST = {
  subscriptionsListPage: 1,
  subscriptionsDelete: 50,
};

export const DAILY_QUOTA_BUDGET = DAILY_BUDGET;

/**
 * The next moment, in UTC ms, at which the PT calendar date changes.
 * That is the moment Google's daily quota resets. DST-safe via Intl.
 */
export function nextPtMidnightMs(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const currentPtDate = fmt.format(now);
  let lo = now.getTime();
  let hi = lo + 26 * 3600 * 1000;
  // Make sure hi is in a different PT day. (Defensive — 26h is enough across any DST shift.)
  while (fmt.format(new Date(hi)) === currentPtDate) hi += 3600 * 1000;
  // Bisect to nearest minute.
  while (hi - lo > 60_000) {
    const mid = Math.floor((lo + hi) / 2);
    if (fmt.format(new Date(mid)) === currentPtDate) lo = mid;
    else hi = mid;
  }
  return hi;
}
