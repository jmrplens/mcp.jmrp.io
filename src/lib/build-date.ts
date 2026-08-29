import { execFileSync } from "node:child_process";

/**
 * The content's REAL last-modified date, for `dateModified`, the sitemap's
 * `lastmod` and the footer's "Updated" line.
 *
 * The rule: clean tree → HEAD's commit date; dirty tree → the current time,
 * because what is being built is newer than any commit.
 *
 * The rule exists because of a real defect an external audit caught: the
 * deployment flow builds BEFORE committing, so `git log -1` always pointed at
 * the previous commit and the site published a stale `dateModified`.
 *
 * And not an unconditional `new Date()`: with the build's clock, every deploy
 * would announce new content even when not a comma changed, and search engines
 * end up ignoring the field. Without git (a tarball, a container),
 * `undefined`: an absent date is correct; an invented one is not.
 */
// An absolute path and not a bare "git": resolving through PATH is a classic
// vector and sonarjs forbids it. If git lives elsewhere in some environment,
// the catch returns undefined, which is the intended behaviour without git.
const GIT = "/usr/bin/git";

/**
 * Resolves that date, applying the clean/dirty rule described above.
 *
 * @returns An ISO date string, or undefined when git is unavailable.
 */
export function contentDate(): string | undefined {
  const opts = {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  } satisfies Parameters<typeof execFileSync>[2];
  try {
    const dirty = execFileSync(GIT, ["status", "--porcelain"], opts).trim();
    if (dirty) return new Date().toISOString();
    return execFileSync(GIT, ["log", "-1", "--format=%cI"], opts).trim();
  } catch {
    return undefined;
  }
}

// Memoized: set on the first call, reused by every later one for the rest of
// the process. `contentDate()` itself returns a freshly-read `new Date()` on
// a dirty tree or on any call after `catch` falls through below — call it
// more than once per build and each caller can get a different instant a few
// milliseconds apart. `buildDate()` exists so the footer, the JSON-LD
// `dateModified` and `<UpdatedLine>` all read the SAME resolved value instead
// of each computing their own fallback.
let resolvedBuildDate: string | undefined;

/**
 * `contentDate()` with the "no git" fallback applied, memoized for the whole
 * process so every consumer shares one instant.
 *
 * See the module doc for the underlying rule (HEAD's date on a clean tree,
 * "now" on a dirty one); this only adds the shared "now" when git itself is
 * unavailable, which `contentDate()` alone leaves as `undefined`.
 */
export function buildDate(): string {
  resolvedBuildDate ??= contentDate() ?? new Date().toISOString();
  return resolvedBuildDate;
}

/**
 * The site's publication date, for `datePublished`: the first commit.
 *
 * It is a fact, not a choice: the repository was born with the site. The same
 * rule as above for the no-git case — `undefined`, and the field is omitted,
 * because an absent date is correct and an invented one is not.
 */
export function publishedDate(): string | undefined {
  const opts = {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  } satisfies Parameters<typeof execFileSync>[2];
  try {
    const out = execFileSync(
      GIT,
      ["log", "--max-parents=0", "--format=%cI"],
      opts,
    ).trim();
    // A repo can have several roots (merged histories); the oldest one is the
    // last line.
    return out.split("\n").at(-1) || undefined;
  } catch {
    return undefined;
  }
}
