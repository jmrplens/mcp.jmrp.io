#!/usr/bin/env node
/**
 * Deploys the artifacts the build generated to nginx.
 *
 * THE _mcp SUFFIX IS MANDATORY: jmrp.io deploys its own snippets into the same
 * directory (/etc/nginx/snippets). A repeated name leaves the other site with
 * the wrong CSP, and the failure is silent: nginx reloads perfectly happily.
 *
 * If `nginx -t` fails after copying, each file's previous content is restored
 * and the script exits with an error WITHOUT reloading: keeping the old
 * configuration beats leaving nginx unable to reload at all.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  parseSitemapEntries,
  selectChangedUrls,
  submissionLimit,
} from "./lib/url-submission.mjs";

// The repo's `.env` (gitignored) carries the Bing Webmaster key. Same as in
// jmrp.io: `loadEnvFile` does NOT override what already comes from the
// environment, so an exported value still wins. A missing file is fine — each
// consumer decides whether it can carry on without its credential.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // No .env: carry on with whatever the environment provides.
}

const DIST = path.resolve("dist");

/**
 * Where the generated `security_headers*.conf` are copied.
 *
 * Gated on the variable, like every other publish action in this script
 * (Cloudflare, IndexNow, Bing): unset means "do not touch Nginx". Without the
 * gate this step was the one thing here that assumed it always ran on the
 * production host, so `pnpm build` in CI died on EACCES writing to
 * /etc/nginx/snippets — CI has no Nginx and no business having one.
 *
 * The value lives in the repo's gitignored `.env` on the server. jmrp.io hit
 * the failure mode this ordering avoids: there the variable was read BEFORE
 * `.env` was merged, so for seven weeks every deploy logged "skipping Nginx"
 * and silently stopped publishing the headers. Hence the loud warning below
 * rather than a quiet skip.
 */
const SNIPPETS = process.env.POSTBUILD_NGINX_SNIPPETS_PATH;

/**
 * Binaries by ABSOLUTE path, not through PATH.
 *
 * This script writes into /etc/nginx and reloads the service: if PATH included
 * a directory writable by another user, `execFileSync("nginx", …)` would run
 * whatever was there with those privileges.
 */
const NGINX_BIN = "/usr/sbin/nginx";

/**
 * Where the build stages the snippets it generates, and where they land.
 *
 * They are staged OUTSIDE the repository and outside the served tree (see
 * `src/integrations/post-build/nginx-snippets.ts`) and moved into their own
 * subdirectory here, which the vhost includes with a wildcard: a file this
 * build did not produce degrades to an empty include instead of being fatal
 * to the next reload, whoever triggers it.
 */
const STAGING =
  process.env.MCP_NGINX_STAGING ?? "/var/lib/mcp.jmrp.io/nginx-staged";
const SYSTEMCTL_BIN = "/usr/bin/systemctl";
const FILES = ["security_headers_mcp.conf", "security_headers_assets_mcp.conf"];
const VHOST = "/etc/nginx/sites-enabled/mcp.jmrp.io.conf";

for (const f of FILES) {
  if (fs.existsSync(path.join(DIST, f))) continue;

  console.error(`✗ dist/${f} is missing — run 'pnpm build' first`);
  process.exit(1);
}

/**
 * The configuration the vhost includes from the generated directory.
 *
 * The sixty markdown-twin locations used to be written into the vhost by hand
 * and are emitted by the build now, so a route check reading only the vhost
 * warns about all 72 twins on every deploy — every one of which is served, by
 * the include sitting right there. A check that cries wolf every time stops
 * being read, which is worse than not having it.
 *
 * @returns The concatenated snippets, or "" when there are none to read.
 */
function generatedConfig() {
  const dir = SNIPPETS ? path.join(SNIPPETS, "mcp") : undefined;
  if (!dir || !fs.existsSync(dir)) return "";
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".conf"))
    .map((name) => `\n${fs.readFileSync(path.join(dir, name), "utf8")}`)
    .join("");
}

/**
 * Warns about the files in dist/ that nginx does not serve.
 *
 * The vhost serves by ALLOWLIST and ends in `location / { return 404; }`, so a
 * new file at the build's root (robots.txt, llms.txt, og-*.png…) returns 404
 * in production until someone adds its `location`. That mismatch was mute: the
 * build passed, the deployment passed, and only a `curl` by hand found it.
 *
 * It is a WARNING and not an error on purpose. This script does not edit
 * /etc/nginx — the vhost is touched by hand, with review — so failing here
 * would leave the site impossible to deploy over a file that may not even be
 * meant to be published. What is needed is that nobody can say they did not
 * know.
 */
function warnUnservedFiles() {
  let vhost;
  try {
    vhost = fs.readFileSync(VHOST, "utf8");
  } catch {
    console.warn(`⚠ could not read ${VHOST}: the routes are not checked`);
    return;
  }

  // What the vhost includes from the generated directory counts as vhost for
  // this check — see `generatedConfig`.
  vhost += generatedConfig();

  // `location = /x` (exact) and `location ^~ /x` or `location /x` (prefix).
  const exact = new Set();
  const prefixes = [];
  for (const m of vhost.matchAll(
    /^[ \t]*location[ \t]+(?:(=|\^~)[ \t]*)?(\S+)[ \t]*\{/gm,
  )) {
    const [, modifier, uri] = m;
    if (!uri.startsWith("/")) continue; // regex (~) and named (@): they do not apply
    if (modifier?.startsWith("=")) exact.add(uri);
    else prefixes.push(uri);
  }

  // The root AND subdirectories. The previous version only looked at the root
  // (readdirSync with no recursion) and /servers/gitlab/actions.json — a
  // nested JSON whose URL is exactly its path — reached production as a 404
  // with nobody warning about it (2026-08-26). The .html files stay out of the
  // recursive sweep: their pretty URLs (/servers/gitlab/ → index.html) are
  // declared per directory and mapping them here would duplicate the vhost's
  // logic; the non-HTML files have no such indirection and are checked as they
  // are.
  const missing = fs
    .readdirSync(DIST, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => {
      const rel = path.relative(DIST, path.join(e.parentPath, e.name));
      return rel.split(path.sep).join("/");
    })
    // Snippets are COPIED to /etc/nginx, not served; the .br/.gz files nginx
    // picks on its own next to the original; the index.html files are served by
    // their directory's exact locations.
    .filter(
      (rel) =>
        !FILES.includes(rel) &&
        !rel.endsWith(".br") &&
        !rel.endsWith(".gz") &&
        !rel.endsWith(".html"),
    )
    // Astro cannot emit folders with a dot, so the build writes well-known/ and
    // the vhost publishes it as /.well-known/ (see its comment "The file on
    // disk is /well-known/…"). For those, the URL to check carries the dot.
    .map((rel) => ({
      rel,
      url: rel.startsWith("well-known/") ? `/.${rel}` : `/${rel}`,
    }))
    .filter(
      ({ url }) =>
        !exact.has(url) &&
        prefixes.every((p) => p === "/" || !url.startsWith(p)),
    );

  if (missing.length === 0) return;

  console.warn(
    `⚠ ${missing.length} build file(s) with no 'location' in the vhost — they will 404:`,
  );
  for (const { rel, url } of missing) {
    console.warn(`    location = ${url} { try_files /${rel} =404; }`);
  }
}

warnUnservedFiles();

if (!SNIPPETS) {
  console.warn(
    "⚠ POSTBUILD_NGINX_SNIPPETS_PATH is unset: the security headers are NOT\n" +
      "  deployed and nginx is not reloaded. That is correct off the server\n" +
      "  (CI, a fresh clone); in production it means the .env is not being\n" +
      "  read, and the headers being served will stay frozen.",
  );
}

/** Each target's previous content, so it can be reverted. */
const backups = new Map();

if (SNIPPETS) {
  for (const f of FILES) {
    const dst = path.join(SNIPPETS, f);
    if (fs.existsSync(dst)) backups.set(dst, fs.readFileSync(dst));
    fs.copyFileSync(path.join(DIST, f), dst);
  }

  try {
    execFileSync(NGINX_BIN, ["-t"], { stdio: "pipe" });
  } catch (error) {
    for (const [dst, buf] of backups) fs.writeFileSync(dst, buf);
    for (const f of FILES) {
      const dst = path.join(SNIPPETS, f);
      if (!backups.has(dst)) fs.rmSync(dst, { force: true });
    }
    console.error("✗ 'nginx -t' failed; snippets restored, nginx NOT reloaded");
    console.error(String(error.stderr ?? error));
    process.exit(1);
  }

  execFileSync(SYSTEMCTL_BIN, ["reload", "nginx"]);
  console.log(`✓ ${FILES.join(", ")} deployed and nginx reloaded`);
}

/**
 * Moves the build's generated snippets into place.
 *
 * Same contract as the block above: back up what is there, deliver, test, and
 * restore everything if `nginx -t` refuses. It runs AFTER the blue/green swap,
 * so the locations it delivers describe the build that is actually being
 * served.
 *
 * A missing staging directory is not an error. It is the normal state off the
 * production host, and it is also what happens when a scratch build is
 * exercised with `MCP_NGINX_STAGING` pointed elsewhere.
 */
function deployStagedSnippets() {
  if (!SNIPPETS || !fs.existsSync(STAGING)) return;

  const target = path.join(SNIPPETS, "mcp");
  fs.mkdirSync(target, { recursive: true });

  const staged = fs
    .readdirSync(STAGING)
    .filter((name) => name.endsWith(".conf"));
  if (staged.length === 0) return;

  /** Previous content of each target, so the whole delivery can be undone. */
  const previous = new Map();
  for (const name of staged) {
    const dst = path.join(target, name);
    previous.set(dst, fs.existsSync(dst) ? fs.readFileSync(dst) : null);
    // Copied and not renamed: the staging copy stays until the test passes,
    // and the mode comes from the source, which the build set deliberately.
    fs.copyFileSync(path.join(STAGING, name), dst);
    // The nginx workers run unprivileged: a 0600 snippet is unreadable to
    // them and produces a 520 on the next reload, which `nginx -t` does not
    // catch because the master is root.
    // eslint-disable-next-line sonarjs/file-permissions -- 0644 is the fix, see above
    fs.chmodSync(dst, 0o644);
  }

  try {
    execFileSync(NGINX_BIN, ["-t"], { stdio: "pipe" });
  } catch (error) {
    for (const [dst, buf] of previous) {
      if (buf) fs.writeFileSync(dst, buf);
      else fs.rmSync(dst, { force: true });
    }
    console.error(
      "✗ 'nginx -t' failed on the generated snippets; the delivery was undone",
    );
    console.error(String(error.stderr ?? error));
    process.exit(1);
  }

  execFileSync(SYSTEMCTL_BIN, ["reload", "nginx"]);
  for (const name of staged)
    fs.rmSync(path.join(STAGING, name), { force: true });
  console.log(`✓ ${staged.length} generated snippet(s) deployed to ${target}`);

  warnAboutUnincludedSnippets(staged);
}

/**
 * Warns about a snippet that was delivered and is never included.
 *
 * `nginx -t` passes either way: an unreferenced file in the snippets
 * directory is not an error, it is simply never read. So a generated snippet
 * that nobody wired into the vhost does nothing at all, silently and for as
 * long as it takes someone to notice — the same failure shape as a `dist/`
 * file with no `location`, which this script already warns about.
 *
 * The vhost is edited by a human on purpose (see AGENTS.md), so this warns
 * and prints the line to paste rather than editing anything.
 *
 * @param staged Names of the snippets that were just delivered.
 */
function warnAboutUnincludedSnippets(staged) {
  let vhost;
  try {
    vhost = fs.readFileSync(VHOST, "utf8");
  } catch {
    return;
  }
  const missing = staged.filter((name) => !vhost.includes(name));
  if (missing.length === 0) return;

  console.warn(
    `⚠ ${missing.length} delivered snippet(s) are not included by the vhost — ` +
      "they are inert until someone adds the include:",
  );
  for (const name of missing)
    console.warn(`    include /etc/nginx/snippets/mcp/${name};`);
}

deployStagedSnippets();

/**
 * Flattens foreign text into a single readable line.
 *
 * What is logged here comes from an HTTP response: a newline in its content
 * would inject fake lines into the log, which is what gets read when a
 * deployment goes wrong.
 *
 * @param value Text from an external source.
 * @returns The same text on one line and bounded.
 */
function oneLine(value) {
  return String(value ?? "")
    .replaceAll(/[\u{0}-\u{1F}\u{7F}]+/gu, " ")
    .slice(0, 300);
}

/**
 * Summarizes the errors the Cloudflare API returns.
 *
 * @param errors The response's `[{ code, message }]` array.
 * @returns One line with each one's code and message.
 */
function describeErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return "no detail";
  return errors
    .map((e) => `${String(e?.code ?? "?")}: ${oneLine(e?.message)}`)
    .join(" · ");
}

// ── Purging the Cloudflare cache ───────────────────────────────────────────
//
// Without this, a new file stays unreachable even though the origin serves it:
// Cloudflare cached the 404 from before it existed and keeps returning it. It
// happened with robots.txt, llms.txt and the two OG cards — the origin
// answered 200 and the domain 404 with `age: 50`. And the OG case is the worst
// of them, because the page was already announcing og:image: a shared link
// reserved the card and left it blank.
//
// Credentials from the environment, as in jmrp.io (PRIVATE_CF_*, defined in
// /root/.bashrc). If they are missing it warns and does NOT fail: the origin's
// deployment has already gone well and blocking it over the CDN would be
// worse.
const { PRIVATE_CF_API_TOKEN: cfToken, PRIVATE_CF_EMAIL: cfEmail } =
  process.env;
const cfZone =
  process.env.PRIVATE_CF_ZONE_ID ?? "44d43a33307a232a60a5af4fc1504613";

if (cfToken) {
  // With an email = Global API Key (legacy headers); without one = API Token.
  const headers = cfEmail
    ? {
        "X-Auth-Email": cfEmail,
        "X-Auth-Key": cfToken,
        "Content-Type": "application/json",
      }
    : {
        Authorization: `Bearer ${cfToken}`,
        "Content-Type": "application/json",
      };

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZone}/purge_cache`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ purge_everything: true }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const body = await response.json();
    console.log(
      body.success
        ? "✓ Cloudflare cache purged"
        : `⚠ the Cloudflare purge failed: ${describeErrors(body.errors)}`,
    );
  } catch (error) {
    console.warn(
      `⚠ could not purge the Cloudflare cache: ${oneLine(error.message)}`,
    );
  }
} else {
  console.warn(
    "⚠ no PRIVATE_CF_API_TOKEN: the Cloudflare cache is not purged.\n" +
      "  If you added new files, they will keep returning 404 on the domain until it expires.",
  );
}

// ── IndexNow ───────────────────────────────────────────────────────────────
//
// Tells Bing and Yandex the content has changed. For a freshly published site
// it is the difference between being indexed in hours and in weeks — the GEO
// audit pointed it out, and it is one of the few things a static site can do
// to speed up its discovery.
//
// It does not fail the deployment when the ping fails: the origin is already
// up to date and indexing is a bonus.
//
// The URL list is every `<loc>` of the sitemap the build just wrote — `dist`
// already points at the new build when this script runs — so a new page is
// submitted the day it ships. It used to be the two home pages only, which
// meant nothing else was ever submitted; the two home pages remain the
// fallback if the sitemap cannot be read.
const HOME_URLS = ["https://mcp.jmrp.io/", "https://mcp.jmrp.io/es/"];

/** `loc -> lastmod` for this build, or an empty map if the sitemap is unreadable. */
const SITEMAP_ENTRIES = (() => {
  try {
    return parseSitemapEntries(
      fs.readFileSync(path.join("dist", "sitemap-0.xml"), "utf8"),
    );
  } catch {
    return new Map();
  }
})();

/**
 * Records what was last announced, so the next deploy can diff against it.
 *
 * `.cache/` is gitignored, survives a build and is wiped by a cache clear — at
 * which point the next deploy announces everything again, which is harmless.
 */
const LEDGER_PATH = path.resolve(".cache", "url-submission-ledger.json");

/** The previous ledger, or null when there is none (first deploy). */
const PREVIOUS_LEDGER = (() => {
  try {
    const parsed = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
})();

/**
 * The URLs to announce this deploy.
 *
 * Not the whole sitemap: only what moved since the ledger. Announcing pages
 * that did not change spends Bing's finite daily quota to say "nothing
 * happened", and IndexNow's documentation warns that it lowers the trust the
 * engines place in the source. This works only because every page now carries
 * a `lastmod` of its OWN — see `src/lib/sitemap-lastmod.ts`; while all 73
 * shared the HEAD date, every commit marked every page as changed.
 *
 * The two home pages remain the fallback when the sitemap cannot be read at
 * all, which is what this step submitted before it learned to read it.
 */
const { changed: SUBMIT_URLS, total: SITEMAP_TOTAL } =
  SITEMAP_ENTRIES.size > 0
    ? selectChangedUrls(SITEMAP_ENTRIES, PREVIOUS_LEDGER)
    : { changed: HOME_URLS, total: HOME_URLS.length };

/**
 * Records the announced state once IndexNow has accepted it.
 *
 * Keyed to IndexNow and not to Bing on purpose: IndexNow takes the whole diff
 * in one call, whereas Bing's quota may only take part of it. Holding the
 * ledger back until Bing catches up would re-announce to IndexNow every day.
 * Bing lags by design and loses nothing by it — IndexNow already notifies Bing
 * through the open protocol; the Webmaster API is the site's own second
 * channel, not the only one.
 *
 * Never fatal: a failed write just means the next deploy re-announces.
 */
function writeLedger() {
  try {
    fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
    fs.writeFileSync(
      LEDGER_PATH,
      `${JSON.stringify(Object.fromEntries(SITEMAP_ENTRIES), null, 2)}\n`,
    );
  } catch (error) {
    console.warn(
      `⚠ could not write the URL submission ledger: ${oneLine(error.message)}`,
    );
  }
}
const INDEXNOW_KEY = /INDEXNOW_KEY = "([a-f0-9]+)"/.exec(
  fs.readFileSync(path.join("src", "lib", "seo.ts"), "utf8"),
)?.[1];

if (INDEXNOW_KEY && SUBMIT_URLS.length === 0) {
  console.log(
    `ℹ IndexNow: nothing changed since the last deploy (${SITEMAP_TOTAL} URLs in the sitemap), skipping`,
  );
} else if (INDEXNOW_KEY) {
  try {
    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "mcp.jmrp.io",
        key: INDEXNOW_KEY,
        keyLocation: `https://mcp.jmrp.io/${INDEXNOW_KEY}.txt`,
        urlList: SUBMIT_URLS,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    // 200 and 202 are both acceptance; 422 usually means the key is not visible yet.
    if (response.ok) {
      console.log(
        `✓ IndexNow notified (HTTP ${response.status}, ${SUBMIT_URLS.length} of ${SITEMAP_TOTAL} URLs)`,
      );
      // Only now: the ledger records what an API has actually accepted, so a
      // rejected submission is retried rather than silently forgotten.
      if (SITEMAP_ENTRIES.size > 0) writeLedger();
    } else {
      console.warn(`⚠ IndexNow returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(`⚠ could not notify IndexNow: ${oneLine(error.message)}`);
  }
}

// ── Bing Webmaster (URL Submission) ────────────────────────────────────────
//
// IndexNow and this API are DIFFERENT pipelines, not alternatives: the first
// is the open protocol (Bing + Yandex), this one is the site's own Bing
// Webmaster quota. jmrp.io has always used both; here only IndexNow existed.
//
// It matters because the 2026-08-22 audit measured through Bing's API that
// this subdomain sits at `InIndex: 0` — never crawled, `AnchorCount: 0` —
// while jmrp.io is at 903. bingbot has spent weeks re-reading the sitemap
// without fetching a single page. This is the only on-site lever left on that:
// the subdomain is already a verified property in its own right, so the call
// is accepted.
//
// The key comes from the repo's `.env`. If it is missing we warn and do NOT
// fail: the origin is already deployed and indexing is a bonus.
const bingKey = process.env.BING_WEBMASTER_API_KEY;
const BING_SITE_URL = "https://mcp.jmrp.io";

/**
 * What Bing will still accept, or null when the quota cannot be read.
 *
 * @param key The Webmaster API key.
 * @returns `{ daily, monthly }`, or null.
 */
async function bingQuota(key) {
  const response = await fetch(
    "https://ssl.bing.com/webmaster/api.svc/json/GetUrlSubmissionQuota" +
      `?siteUrl=${encodeURIComponent(BING_SITE_URL)}&apikey=${encodeURIComponent(key)}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) return null;
  const { d } = await response.json();
  return Number.isFinite(d?.DailyQuota) && Number.isFinite(d?.MonthlyQuota)
    ? { daily: d.DailyQuota, monthly: d.MonthlyQuota }
    : null;
}

if (bingKey && SUBMIT_URLS.length === 0) {
  console.log(
    "ℹ Bing Webmaster: nothing changed since the last deploy, skipping",
  );
} else if (bingKey) {
  try {
    // Asked BEFORE submitting, because an over-sized batch is rejected whole:
    // sending 73 URLs against 27 left published nothing and logged a bare
    // "HTTP 400". What does not fit today is not lost — it stays out of the
    // ledger only if IndexNow also failed, and Bing catches it up on a later
    // deploy.
    const quota = await bingQuota(bingKey);
    const limit = quota
      ? submissionLimit(quota, SUBMIT_URLS.length)
      : SUBMIT_URLS.length;
    if (limit === 0) {
      console.log(
        `ℹ Bing Webmaster: no quota left today for ${SUBMIT_URLS.length} URLs, skipping`,
      );
    } else {
      const batch = SUBMIT_URLS.slice(0, limit);
      const response = await fetch(
        `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${encodeURIComponent(bingKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json",
          },
          body: JSON.stringify({ siteUrl: BING_SITE_URL, urlList: batch }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      // The API returns 200 with `{"d":null}` when it accepts.
      if (response.ok) {
        console.log(
          `✓ Bing Webmaster notified (${batch.length} of ${SUBMIT_URLS.length} changed URLs)`,
        );
      } else {
        // The BODY, not just the status: Bing explains its refusals in it
        // ("Quota remaining for today: 27, Submitted: 73"), and logging the
        // status alone is what turned a one-line answer into an investigation.
        console.warn(
          `⚠ Bing Webmaster returned HTTP ${response.status}: ${oneLine(await response.text())}`,
        );
      }
    }
  } catch (error) {
    console.warn(`⚠ could not notify Bing: ${oneLine(error.message)}`);
  }
} else {
  console.warn(
    "⚠ no BING_WEBMASTER_API_KEY: the URLs are not sent to Bing Webmaster.",
  );
}
