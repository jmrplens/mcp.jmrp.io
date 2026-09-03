/**
 * Each page's dates, from the git history of what that page is made of.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * The sitemap used to stamp ONE date — `contentDate()`, the HEAD commit — on
 * all 73 URLs. Every commit therefore moved every `lastmod`, so the sitemap
 * asserted that the whole site changed whenever anything did. That is wrong on
 * its own terms, and it also made the deploy's differential submission
 * impossible: `scripts/deploy-live-mcp.mjs` diffs this value against a ledger
 * to work out what to announce to IndexNow and Bing, and a date that always
 * moves selects everything, every time. Bing's daily quota is smaller than the
 * sitemap, and it rejects an over-sized batch WHOLE, so "everything changed"
 * ended up announcing nothing at all.
 *
 * The approach is jmrp.io's (`src/integrations/sitemap-post-dates.ts`): key
 * each route to the files that actually hold its content and ask git when they
 * last moved.
 *
 * ── The deliberate trade-off ──────────────────────────────────────────────
 * The site's shell — `Base.astro`, the nav and footer strings in
 * `i18n/ui/common.ts` — is NOT a source of any page here. Including it would
 * put every page back on one shared date the first time a footer link changed,
 * which is the exact failure this module exists to undo. The cost is that a
 * purely-chrome edit is under-reported; the benefit is that `lastmod` means
 * "this page's own content moved", which is what a crawler is being told.
 */
import { execFileSync } from "node:child_process";

import { contentDate, publishedDate } from "./build-date";

/** A page's own dates, as the JSON-LD and the sitemap need them. */
export interface PageDates {
  /** When the page last changed: `dateModified` and `<lastmod>`. */
  dateModified?: string;
  /** When the page first existed: `datePublished`. */
  datePublished?: string;
}

// Absolute path, like `build-date.ts`: resolving `git` through PATH is an
// injection vector and sonarjs forbids it.
const GIT = "/usr/bin/git";

/**
 * Files that hold each route's content, by route shape.
 *
 * Paths are git pathspecs, so a directory covers everything under it. The
 * language prefix is stripped before matching: the two translations of a page
 * are rendered from the same sources, so they share a date.
 */
const STATIC_SOURCES: Record<string, string[]> = {
  "/": [
    "src/components/pages/HomePage.astro",
    "src/i18n/ui/home.ts",
    "src/data/servers.ts",
  ],
  // The island is the page: almost nothing on /inspector/ comes from the
  // .astro shell. `inspector-parts.tsx` and the deeplink helper render and
  // route its panels, so an edit to either is an edit to the page.
  "/inspector/": [
    "src/components/pages/InspectorPage.astro",
    "src/components/Inspector.tsx",
    "src/components/inspector-parts.tsx",
    "src/lib/inspector-deeplink.ts",
    "src/i18n/ui/inspector.ts",
  ],
  "/internals/": [
    "src/components/pages/InternalsPage.astro",
    "src/i18n/ui/internals.ts",
    // Generated from the live census by sync-topology.sh: when the topology
    // moves, the page's diagrams and counts move with it.
    "src/data/topology.json",
  ],
  "/license/": [
    "src/components/pages/LicensePage.astro",
    "src/i18n/ui/license.ts",
  ],
  "/policies/": [
    "src/components/pages/PoliciesPage.astro",
    "src/i18n/ui/policies.ts",
  ],
  "/servers/": [
    "src/components/pages/ServersIndexPage.astro",
    "src/i18n/ui/servers-page.ts",
    "src/data/servers.ts",
  ],
};

// `/inspector/callback/` is the same page's OAuth landing step and carries no
// copy of its own — it moves when the inspector does.
STATIC_SOURCES["/inspector/callback/"] = STATIC_SOURCES["/inspector/"];

/** Sources of one server's card page, `/servers/<id>/`. */
function serverSources(id: string): string[] {
  return [
    "src/components/pages/ServerPage.astro",
    "src/i18n/ui/servers-page.ts",
    "src/data/servers.ts",
    "src/data/server-cards.ts",
    `src/data/cards/${id}.json`,
    `src/data/surface/${id}-discover.json`,
  ];
}

/** Sources of one action-domain page, `/servers/<id>/actions/<domain>/`. */
function actionsSources(id: string): string[] {
  return [
    "src/components/pages/ActionsDomainPage.astro",
    "src/i18n/ui/servers-page.ts",
    "src/data/servers.ts",
    `src/data/surface/${id}-actions.json`,
  ];
}

/**
 * When git last touched any of `pathspecs`.
 *
 * @param pathspecs Repository-relative paths or directories.
 * @returns An ISO date, or undefined when git says nothing about them.
 */
function gitDate(pathspecs: string[]): string | undefined {
  try {
    const out = execFileSync(
      GIT,
      ["log", "-1", "--format=%cI", "--", ...pathspecs],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

/**
 * When git FIRST added any of `pathspecs`.
 *
 * `--diff-filter=A` lists the commits that added a file, newest first, so the
 * last line is the oldest addition — the moment the page began to exist. The
 * whole-repo equivalent (`publishedDate()`) claimed 2026-08-06, the first
 * commit of the repository, for pages that did not exist until weeks later:
 * /license/ was published on the day it shipped, not on the day the repo
 * started.
 *
 * @param pathspecs Repository-relative paths or directories.
 * @returns An ISO date, or undefined when git says nothing about them.
 */
function gitAddedDate(pathspecs: string[]): string | undefined {
  try {
    const out = execFileSync(
      GIT,
      ["log", "--diff-filter=A", "--format=%cI", "--", ...pathspecs],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    // Normally one line. A file that was added, removed and added again has
    // several, and the earliest is when the page first answered.
    return out ? out.split("\n").at(-1) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The file whose existence IS the page's existence, per route.
 *
 * `datePublished` asks when THIS file was added; `dateModified` keeps asking
 * the content sources. The two questions are different, and conflating them
 * is what made 64 of 72 pages claim they were published on 2026-08-06:
 * `serverSources()` and `actionsSources()` both list `src/data/servers.ts`,
 * which shipped with the repository, so the earliest add across a page's
 * sources was that data file's rather than the page's. The result was
 * /servers/gitlab/actions/issue/ claiming it was published twenty days
 * before its route existed, on a URL that answered 404 the whole time.
 *
 * Taking the LATEST add instead would only move the lie: `HomePage.astro`
 * was split out of `index.astro` on 2026-08-23, so the home page would then
 * claim a birthday two weeks after it started answering.
 *
 * Paths are relative to `src/pages/`; the Spanish page is the same path
 * under `es/`. Every route so far shipped both languages in one commit, but
 * the resolver asks for the language it was handed rather than assuming
 * that, so a language added later would date itself honestly.
 */
const ROUTE_FILES: Record<string, string> = {
  "/": "index.astro",
  "/inspector/": "inspector.astro",
  "/inspector/callback/": "inspector/callback.astro",
  "/internals/": "internals.astro",
  "/license/": "license.astro",
  "/policies/": "policies.astro",
  "/servers/": "servers/index.astro",
};

/** Route file behind every `/servers/<id>/`, relative to `src/pages/`. */
const SERVER_ROUTE_FILE = "servers/[server].astro";

/** Route file behind every `/servers/<id>/actions/<domain>/`. */
const ACTIONS_ROUTE_FILE = "servers/[server]/actions/[domain].astro";

/**
 * Where a route file lives for one language.
 *
 * @param relative A path from {@link ROUTE_FILES} or one of the two dynamic
 *   route files, relative to `src/pages/`.
 * @param spanish Whether the page being dated is the Spanish one.
 * @returns The repository-relative path.
 */
function routeFilePath(relative: string, spanish: boolean): string {
  return `src/pages/${spanish ? "es/" : ""}${relative}`;
}

/** `/servers/<id>/actions/<domain>/`, language prefix already stripped. */
const ACTIONS_ROUTE = /^\/servers\/([^/]+)\/actions\/[^/]+\/$/;

/** `/servers/<id>/`, language prefix already stripped. */
const SERVER_ROUTE = /^\/servers\/([^/]+)\/$/;

/** Whether the working tree has uncommitted changes. */
function isDirty(): boolean {
  try {
    return (
      execFileSync(GIT, ["status", "--porcelain"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() !== ""
    );
  } catch {
    // No git at all: treat as dirty so the caller keeps its single fallback
    // date rather than emitting no `lastmod`.
    return true;
  }
}

/**
 * The route a URL path describes, with the language prefix removed.
 *
 * The language comes back with it: the route decides which sources describe
 * the page, and the language decides which of the two route files is the one
 * whose add date is that page's publication.
 *
 * @param pathname A path from the sitemap, e.g. `/es/servers/gitlab/`.
 * @returns The language-independent route (always with a trailing slash) and
 *   whether the path was the Spanish one.
 */
function routeOf(pathname: string): { route: string; spanish: boolean } {
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  // `/es/` is the Spanish HOME, so stripping the prefix has to leave "/" and
  // not the empty string, which would match no route at all.
  if (withSlash === "/es/") return { route: "/", spanish: true };
  return withSlash.startsWith("/es/")
    ? { route: withSlash.slice(3), spanish: true }
    : { route: withSlash, spanish: false };
}

/** The one resolver every caller shares, built on first use. */
let sharedResolver: ((pathname: string) => PageDates) | undefined;

/**
 * One page's dates, from the resolver every consumer shares.
 *
 * The sitemap's `lastmod`, the JSON-LD's `dateModified` and the `Updated:`
 * line of the markdown twin are the same claim about the same page, made to
 * three different audiences. Reading them from one memoized resolver is what
 * makes them the same VALUE rather than three computations that agree today.
 *
 * @param pathname A page path, e.g. `/es/servers/gitlab/`.
 * @returns That page's dates; fields are undefined when the caller should
 *   fall back to its own site-wide values.
 */
export function pageDatesOf(pathname: string): PageDates {
  sharedResolver ??= createPageDatesResolver();
  return sharedResolver(pathname);
}

/**
 * Builds the per-page `lastmod` resolver the sitemap serializer calls.
 *
 * git is asked once per distinct source set and the answer is memoized: the
 * sitemap has 73 URLs but only a handful of shapes, and a subprocess per URL
 * would be paid on every build. Most callers want {@link pageDatesOf}, which
 * shares one of these; this stays exported for the sitemap integration, which
 * builds its own for one pass.
 *
 * On a DIRTY tree (or with no git) it resolves nothing and the caller keeps
 * its single fallback date. That is deliberate: `build-date.ts` already treats
 * a dirty tree as "the commit date is not the content date", and inventing
 * per-page dates from a tree that does not match any commit would be worse
 * than the honest whole-site stamp.
 *
 * @returns A function from URL path to that page's dates; both fields are
 *   undefined when the caller should fall back to its own site-wide values.
 */
export function createPageDatesResolver(): (pathname: string) => PageDates {
  const dirty = isDirty();
  // The repository's own dates, used for a route with no entry of its own so a
  // new page never ships without them. On a dirty tree they are left unset,
  // which is what makes every lookup below resolve to nothing and hands the
  // decision back to the caller's own fallback.
  const fallbackModified = dirty ? undefined : contentDate();
  const fallbackPublished = dirty ? undefined : publishedDate();
  const fallback: PageDates = {
    dateModified: fallbackModified,
    datePublished: fallbackPublished,
  };
  const cache = new Map<string, PageDates>();

  const datesFor = (
    contentSources: string[],
    routeFile: string,
  ): PageDates => {
    const key = `${routeFile} ${contentSources.join(" ")}`;
    let dates = cache.get(key);
    if (!dates) {
      // A page that has a route file but whose language variant does not
      // exist falls back to the language-independent one rather than to the
      // whole repository's date.
      const published =
        gitAddedDate([routeFile]) ??
        gitAddedDate([routeFile.replace("src/pages/es/", "src/pages/")]);
      dates = {
        dateModified: gitDate(contentSources) ?? fallbackModified,
        datePublished: published ?? fallbackPublished,
      };
      cache.set(key, dates);
    }
    return dates;
  };

  return (pathname: string) => {
    if (dirty) return fallback;

    const { route, spanish } = routeOf(pathname);
    const staticSources = STATIC_SOURCES[route];
    const staticRouteFile = ROUTE_FILES[route];
    if (staticSources && staticRouteFile) {
      return datesFor(staticSources, routeFilePath(staticRouteFile, spanish));
    }

    const actions = ACTIONS_ROUTE.exec(route);
    if (actions) {
      return datesFor(
        actionsSources(actions[1]),
        routeFilePath(ACTIONS_ROUTE_FILE, spanish),
      );
    }

    const server = SERVER_ROUTE.exec(route);
    if (server) {
      return datesFor(
        serverSources(server[1]),
        routeFilePath(SERVER_ROUTE_FILE, spanish),
      );
    }

    return fallback;
  };
}
