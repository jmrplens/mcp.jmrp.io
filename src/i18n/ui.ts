import { common } from "./ui/common.ts";
import { home } from "./ui/home.ts";
import { inspector } from "./ui/inspector.ts";
import { internals } from "./ui/internals.ts";
import { policies } from "./ui/policies.ts";

/**
 * UI strings, composed from one module per page.
 *
 * The shape is unchanged (`ui.en.<key>`), so no consumer had to be touched
 * when this was split: the file had grown to 273 lines and four pages would
 * have tripled it.
 *
 * `common` is spread LAST on purpose. `internals.ts` already defines its own
 * `metaTitle`/`title`/`lede` for the page a later task builds, and those key
 * names collide with `common`'s site-identity strings of the same name.
 * `home` is the only page live today, so `common`'s values (which are what
 * every current consumer of `ui.en.title` etc. expects) must win the merge —
 * spreading `common` last guarantees that regardless of what any other page
 * module defines. Whoever wires up `/internals/` should read
 * `internals.en.title` directly rather than through this merged object.
 */
export const ui = {
  en: { ...home.en, ...inspector.en, ...internals.en, ...policies.en, ...common.en },
  es: { ...home.es, ...inspector.es, ...internals.es, ...policies.es, ...common.es },
} as const;

// `Lang` now lives in `./config`; re-exported so existing imports keep working.
export type { Lang } from "./config";
