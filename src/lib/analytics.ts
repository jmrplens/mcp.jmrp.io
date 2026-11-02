/**
 * Cloudflare Web Analytics on this site: which pages load it, and with which
 * site token.
 *
 * The beacon itself is downloaded at build time by
 * scripts/sync-cf-beacon.mjs and served from this site; Base.astro emits the
 * tag. It sets no cookies and stores nothing in the browser, and it reports
 * the page, the referrer and load timings to cloudflareinsights.com, the one
 * destination the CSP adds for it.
 */
import type { PageId } from "./seo";

/**
 * The Web Analytics site token. Public by design: it sits in every page's
 * HTML, and all it lets anyone do is send this site's dashboard a report.
 */
export const CF_BEACON_TOKEN = "42b10a625ed04d2db7358d3128464499";

/**
 * Whether a page loads the beacon: every page but the inspector's.
 *
 * The inspector is the one page where a credential is typed or obtained, and
 * its Content-Security-Policy is the guarantee the gitlab notice and the
 * policies page give about it: `connect-src 'self' https://gitlab.com`, so
 * the browser refuses to send the token anywhere else. Analytics needs
 * cloudflareinsights.com in that list, and cloudflareinsights.com accepts a
 * report under anyone's token, so on the inspector it would be a second way
 * out for a token. The inspector's pages, its OAuth callback included, all
 * say `page="inspector"`; the vhost's `$mcp_connect_src` map keeps their
 * policy without the second origin.
 *
 * @param page The page's id, as Base.astro receives it.
 * @returns True when the page carries the beacon.
 */
export function pageLoadsAnalytics(page: PageId): boolean {
  return page !== "inspector";
}
