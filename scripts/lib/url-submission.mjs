/**
 * Which URLs a deploy should announce, and how many of them Bing will take.
 *
 * These live here and not inside `scripts/deploy-live-mcp.mjs` because that
 * file is a DEPLOY script with top-level side effects: importing it from a test
 * would copy snippets into /etc/nginx and reload the service. Everything in
 * this module is a pure function over plain values, so
 * `tests/unit/url-submission.test.mjs` can exercise the rules that actually
 * broke without a network, a key or a web server.
 *
 * ── The two rules ─────────────────────────────────────────────────────────
 * 1. Announce what CHANGED. Every deploy used to send all 73 sitemap URLs.
 *    IndexNow's documentation is explicit that resubmitting unchanged URLs
 *    lowers the trust a search engine puts in the source, and Bing's quota is
 *    a finite budget being spent to say "nothing happened".
 * 2. Never send Bing more than it will take. It rejects an over-sized batch
 *    WHOLE rather than accepting the part that fits — the first deploy that
 *    sent the full sitemap got back
 *    `{"ErrorCode":2,"Message":"ERROR!!! Quota remaining for today: 27,
 *    Submitted: 73"}` and published nothing.
 */

/**
 * Most URLs Bing accepts in one `SubmitUrlbatch` call.
 *
 * The daily quota is far below this today, so {@link submissionLimit} is
 * normally decided by the quota; the cap is here so the batch cannot become
 * invalid the day the quota is raised past it.
 */
export const MAX_BATCH = 500;

/**
 * Extracts `loc → lastmod` from a sitemap document.
 *
 * Read per `<url>` block rather than with two independent global matches: a
 * `<url>` with no `<lastmod>` would otherwise shift every later date onto the
 * wrong URL, which silently corrupts the ledger instead of failing.
 *
 * @param xml Raw sitemap XML.
 * @returns The entries in document order; `lastmod` is "" when absent.
 */
export function parseSitemapEntries(xml) {
  const entries = new Map();
  for (const block of String(xml ?? "").matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block[1])?.[1]?.trim();
    if (!loc) continue;
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(block[1])?.[1]?.trim();
    entries.set(loc, lastmod ?? "");
  }
  return entries;
}

/**
 * Narrows the sitemap down to the URLs worth announcing.
 *
 * A URL is announced when it is new, when its `lastmod` moved, or when it has
 * no `lastmod` at all — the last case being "no change signal available",
 * where announcing is the safe answer. With no previous ledger everything is
 * announced, which is the correct bootstrap.
 *
 * @param current `loc → lastmod` from this build (see {@link parseSitemapEntries}).
 * @param previous The ledger written after the last deploy, or null on the first.
 * @returns The URLs to announce, how many exist, and whether this is a bootstrap.
 */
export function selectChangedUrls(current, previous) {
  const total = current?.size ?? 0;
  if (total === 0) return { changed: [], total: 0, isBootstrap: false };
  if (!previous) return { changed: [...current.keys()], total, isBootstrap: true };
  const changed = [...current.entries()]
    .filter(([loc, lastmod]) => !lastmod || previous[loc] !== lastmod)
    .map(([loc]) => loc);
  return { changed, total, isBootstrap: false };
}

/**
 * How many URLs Bing may be sent right now.
 *
 * Every bound applies at once — what is left today, what is left this month,
 * how many URLs there are, and the per-call cap — because exceeding any one of
 * them costs the entire batch, not the excess.
 *
 * @param quota `{ daily, monthly }` as read from `GetUrlSubmissionQuota`.
 * @param urlCount How many URLs are waiting to be submitted.
 * @returns The batch size, never negative.
 */
export function submissionLimit(quota, urlCount) {
  const daily = Number.isFinite(quota?.daily) ? quota.daily : 0;
  const monthly = Number.isFinite(quota?.monthly) ? quota.monthly : 0;
  const available = Number.isFinite(urlCount) ? urlCount : 0;
  return Math.max(0, Math.min(daily, monthly, available, MAX_BATCH));
}
