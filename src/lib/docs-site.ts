/**
 * Where a server's documentation site lives, and whether an address a server
 * card publishes is just another way to reach it.
 *
 * Each server's card declares a `websiteUrl`, and the server page links it
 * next to its own "Documentation" link (`docsSite` in `src/data/servers.ts`).
 * The cards come from each server's release, and they can name an address
 * that only redirects to the documentation site: libgen's card still says
 * `https://jmrp.io/docs/libgen-mcp`, which jmrp.io answers with a 301 to
 * `https://docs.jmrp.io/libgen-mcp/`, and gitlab's says
 * `https://docs.jmrp.io/gitlab-mcp-server`, which docs.jmrp.io answers with a
 * 301 to the same path with its trailing slash. Linking those as they are
 * would put two different URLs for one destination on the same page, and one
 * of them a redirect.
 *
 * @module
 */

/**
 * The documentation site an address resolves to, as a comparable key: scheme,
 * lowercase host and path without its trailing slash, with jmrp.io's
 * `/docs/<repo>` rewritten to `docs.jmrp.io/<repo>`, the 301 jmrp.io's nginx
 * map answers for every repository (its keys are lowercase, so the repo is
 * matched without case). Undefined for a string that is not a URL.
 *
 * @param url An absolute URL.
 * @returns The key, or undefined.
 */
function docsSiteKey(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  let host = parsed.hostname.toLowerCase();
  // Trailing slashes trimmed without a regex (`/\/+$/` backtracks
  // super-linearly, Sonar S8786).
  let path = parsed.pathname;
  while (path.endsWith("/")) path = path.slice(0, -1);
  const alias = /^\/docs\/([^/]+)$/i.exec(path);
  if (host === "jmrp.io" && alias) {
    host = "docs.jmrp.io";
    path = `/${alias[1].toLowerCase()}`;
  }
  return `${parsed.protocol}//${host}${path}${parsed.search}`;
}

/**
 * Whether two addresses reach the same documentation site.
 *
 * @param a An absolute URL.
 * @param b Another absolute URL.
 * @returns True when both resolve to the same documentation site.
 */
export function sameDocsSite(a: string, b: string): boolean {
  const keyA = docsSiteKey(a);
  return keyA !== undefined && keyA === docsSiteKey(b);
}

/**
 * The address to link for a card's `websiteUrl`: the server's own
 * `docsSite` when the card's address is only another way to reach it, so
 * the page links one final URL for one destination; the card's address
 * otherwise, verbatim.
 *
 * @param websiteUrl `serverInfo.websiteUrl` as the card declares it.
 * @param docsSite The server's `docsSite`, if it has one.
 * @returns The URL to put in the link.
 */
export function websiteHref(
  websiteUrl: string,
  docsSite: string | undefined,
): string {
  return docsSite && sameDocsSite(websiteUrl, docsSite) ? docsSite : websiteUrl;
}
