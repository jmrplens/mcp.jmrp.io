import assert from "node:assert/strict";
import { test } from "node:test";

import { ui } from "../../src/i18n/ui.ts";
import { common } from "../../src/i18n/ui/common.ts";
import { home } from "../../src/i18n/ui/home.ts";
import { inspector } from "../../src/i18n/ui/inspector.ts";
import { internals } from "../../src/i18n/ui/internals.ts";
import { license } from "../../src/i18n/ui/license.ts";
import { policies } from "../../src/i18n/ui/policies.ts";
import { serversPage } from "../../src/i18n/ui/servers-page.ts";

// `ui` merges these four with a flat spread, so two modules sharing a key
// would silently drop one of them AND disable the missing-key type check that
// keeps both languages in sync. That already happened once: `internals` was
// spread in here and its `title` masked `common`'s, so deleting a Spanish
// string produced zero type errors. This test is the guard.
const MERGED = { common, home, inspector, license, policies };

/** `sort()` compares as strings by default; ESLint wants that made explicit. */
const sorted = (keys) => [...keys].sort((a, b) => a.localeCompare(b));

test("no pair of merged modules shares a key", () => {
  for (const lang of ["en", "es"]) {
    const owner = new Map();
    for (const [name, mod] of Object.entries(MERGED)) {
      for (const key of Object.keys(mod[lang])) {
        const previous = owner.get(key);
        assert.equal(
          previous,
          undefined,
          `"${key}" is in both ${previous} and ${name} (${lang}): ui.ts's spread would drop one`,
        );
        owner.set(key, name);
      }
    }
  }
});

/**
 * Leaf paths of a value, not just its top-level keys: `Object.keys` is
 * shallow, so `insp` (53 labels nested under one key) and the `*Body` arrays
 * in `policies` (a shorter Spanish array is still valid `Object.keys` output)
 * both escaped this guard before. Walking the structure closes that gap.
 */
const leafPaths = (value, prefix = "") => {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => leafPaths(item, `${prefix}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.keys(value).flatMap((key) =>
      leafPaths(value[key], prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
};

// `internals` and `serversPage` are deliberately left out of MERGED (their
// keys collide with `common`'s), so the language parity of the rest did not
// cover them: they were the only modules whose Spanish could fall short with
// nothing complaining.
test("both languages expose exactly the same keys", () => {
  for (const [name, mod] of Object.entries({
    ...MERGED,
    internals,
    serversPage,
  })) {
    assert.deepEqual(
      sorted(leafPaths(mod.en)),
      sorted(leafPaths(mod.es)),
      `${name}: en and es do not have the same keys`,
    );
  }
  assert.deepEqual(sorted(leafPaths(ui.en)), sorted(leafPaths(ui.es)));
});
