/**
 * Which pages actually have a markdown twin, derived from the routes.
 *
 * The `<link rel="alternate" type="text/markdown">` tag used to be computed
 * from the canonical URL and gated on "not the 404, not noindex". That is
 * true of this site today — 72 pages, 72 twins — and it is a guess: it says
 * a twin exists because the page looks like the kind of page that would have
 * one. The day someone adds a page without adding its `index.md.ts`, the head
 * advertises a URL that answers 404, and nothing fails while it does.
 *
 * So membership is read from the twin routes themselves. `import.meta.glob`
 * is evaluated by Vite at build time and only the KEYS are read here — no
 * loader is ever called — so pulling this into the layout does not drag every
 * twin endpoint into the head's module graph.
 *
 * jmrp.io reached the same design from the other direction: it shipped the
 * announcement as an opt-in prop first, and twenty of its ninety-six twinned
 * pages silently never passed it.
 *
 * @module
 */

/** Where Vite's glob keys start. */
const PAGES_PREFIX = "/src/pages/";

/** What a twin route file is called, directory included. */
const TWIN_SUFFIX = "index.md.ts";

/**
 * Every twin route, as the page path it serves.
 *
 * `src/pages/index.md.ts` is the home page's, and slicing leaves the empty
 * string for it, which is why the fallback is `/`. A dynamic segment stays
 * as its bracket form here and is turned into a wildcard by
 * {@link hasMarkdownTwin}.
 */
const TWIN_ROUTES: ReadonlySet<string> = new Set(
  Object.keys(import.meta.glob("/src/pages/**/index.md.ts")).map((file) => {
    const withoutPrefix = file.slice(PAGES_PREFIX.length);
    const withoutSuffix = withoutPrefix.slice(
      0,
      withoutPrefix.length - TWIN_SUFFIX.length,
    );
    return `/${withoutSuffix}`;
  }),
);

// An empty registry means the glob stopped matching — a moved directory, a
// renamed convention — and the symptom would otherwise be every markdown
// announcement quietly disappearing from the site at once. Fail the build
// instead.
if (TWIN_ROUTES.size === 0) {
  throw new Error(
    "twin-routes: no `index.md.ts` under src/pages — the glob pattern is stale",
  );
}

/**
 * One route pattern as a matcher, with `[param]` standing for any segment.
 *
 * @param route A member of {@link TWIN_ROUTES}, e.g. `/servers/[server]/`.
 * @returns A regular expression anchored to the whole path.
 */
function matcher(route: string): RegExp {
  const source = route
    .split("/")
    .map((segment) =>
      /^\[.+]$/.test(segment)
        ? "[^/]+"
        : segment.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`),
    )
    .join("/");
  return new RegExp(`^${source}$`);
}

/** The matchers, built once: the set is fixed at build time. */
const MATCHERS: readonly RegExp[] = [...TWIN_ROUTES].map(matcher);

/**
 * Whether a page publishes a markdown twin.
 *
 * @param pathname A page path with a trailing slash, e.g. `/es/policies/`.
 * @returns True when a twin route serves `<pathname>index.md`.
 */
export function hasMarkdownTwin(pathname: string): boolean {
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return MATCHERS.some((pattern) => pattern.test(withSlash));
}
