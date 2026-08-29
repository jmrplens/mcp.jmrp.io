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
const SYSTEMCTL_BIN = "/usr/bin/systemctl";
const FILES = ["security_headers_mcp.conf", "security_headers_assets_mcp.conf"];
const VHOST = "/etc/nginx/sites-enabled/mcp.jmrp.io.conf";

for (const f of FILES) {
  if (fs.existsSync(path.join(DIST, f))) continue;

  console.error(`✗ dist/${f} is missing — run 'pnpm build' first`);
  process.exit(1);
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
// audit pointed it out, and it is one of the few things a two-page site can do
// to speed up its discovery.
//
// It does not fail the deployment when the ping fails: the origin is already
// up to date and indexing is a bonus.
const INDEXNOW_KEY = /INDEXNOW_KEY = "([a-f0-9]+)"/.exec(
  fs.readFileSync(path.join("src", "lib", "seo.ts"), "utf8"),
)?.[1];

if (INDEXNOW_KEY) {
  try {
    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "mcp.jmrp.io",
        key: INDEXNOW_KEY,
        keyLocation: `https://mcp.jmrp.io/${INDEXNOW_KEY}.txt`,
        urlList: ["https://mcp.jmrp.io/", "https://mcp.jmrp.io/es/"],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    // 200 and 202 are both acceptance; 422 usually means the key is not visible yet.
    console.log(
      response.ok
        ? `✓ IndexNow notified (HTTP ${response.status})`
        : `⚠ IndexNow returned HTTP ${response.status}`,
    );
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

if (bingKey) {
  try {
    const response = await fetch(
      `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${encodeURIComponent(bingKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json",
        },
        body: JSON.stringify({
          siteUrl: "https://mcp.jmrp.io",
          urlList: ["https://mcp.jmrp.io/", "https://mcp.jmrp.io/es/"],
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    // The API returns 200 with `{"d":null}` when it accepts. A 400 is usually
    // the daily quota being spent, which is not a deployment failure.
    console.log(
      response.ok
        ? `✓ Bing Webmaster notified (HTTP ${response.status})`
        : `⚠ Bing Webmaster returned HTTP ${response.status}`,
    );
  } catch (error) {
    console.warn(`⚠ could not notify Bing: ${oneLine(error.message)}`);
  }
} else {
  console.warn(
    "⚠ no BING_WEBMASTER_API_KEY: the URLs are not sent to Bing Webmaster.",
  );
}
