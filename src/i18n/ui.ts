import { common } from "./ui/common.ts";
import { home } from "./ui/home.ts";
import { inspector } from "./ui/inspector.ts";
import { license } from "./ui/license.ts";
import { policies } from "./ui/policies.ts";

/**
 * UI strings, composed from one module per page.
 *
 * The shape is unchanged (`ui.en.<key>`), so no consumer had to be touched
 * when this was split: the file had grown to 273 lines and four pages would
 * have tripled it.
 *
 * `internals` is NOT part of this merge, on purpose. It already defines its
 * own `metaTitle`/`title`/`lede` (for the page a later task builds), and
 * those names collide with `common`'s site-identity keys of the same name.
 * Spreading it in here would not be a type error even when it should be one:
 * if `common.es.title` were ever accidentally dropped, the merge would
 * silently fall through to `internals.es.title` instead of leaving `title`
 * missing — which is exactly the incomplete-language bug this file's typing
 * exists to catch (confirmed by deleting `common.es.title` and watching
 * `pnpm typecheck` report 0 errors while `internals` was still spread in).
 * Whoever wires up `/internals/` should import `internals` from
 * `./ui/internals.ts` directly and read `internals.en.title` there, rather
 * than through this merged object.
 */
export const ui = {
  en: {
    ...home.en,
    ...inspector.en,
    ...license.en,
    ...policies.en,
    ...common.en,
  },
  es: {
    ...home.es,
    ...inspector.es,
    ...license.es,
    ...policies.es,
    ...common.es,
  },
} as const;

// `Lang` now lives in `./config`; re-exported so existing imports keep working.
export type { Lang } from "./config";
