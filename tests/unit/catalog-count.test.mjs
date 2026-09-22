/**
 * The action count is data, never prose.
 *
 * GEO audit #4 (2026-09-22): `catalogTokenNote`, the paragraph written to be
 * quotable about why three figures for the same catalog coexist, said "this
 * deployment publishes 747" on 118 served files while the heading two lines
 * above, the 28 `ItemList`s, `/servers.json`, `llms.txt` and `llms-full.txt`
 * all said 765. #45 had grown the catalog; the hand-typed figure stayed. A
 * model reading the page saw two numbers from the same author for the same
 * thing and no way to pick one.
 *
 * So the note carries a `{count}` placeholder that every consumer fills from
 * `actionCatalogs()[id].meta.actionCount`, and no string in the servers page
 * may spell the live figure (or the stale one) by hand.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { actionCatalogs } from "../../src/data/surface.ts";
import { serversPage } from "../../src/i18n/ui/servers-page.ts";

const live = String(actionCatalogs().gitlab?.meta.actionCount ?? "");

test("catalogTokenNote takes its figure from the catalog, in both languages", () => {
  for (const [lang, strings] of Object.entries(serversPage)) {
    assert.ok(
      strings.catalogTokenNote.includes("{count}"),
      lang + ": catalogTokenNote has no {count} placeholder",
    );
  }
});

test("no servers-page string spells the deployment's action count by hand", () => {
  assert.ok(live, "no gitlab catalog snapshot to read the count from");
  const stale = ["747"];
  for (const [lang, strings] of Object.entries(serversPage)) {
    for (const [key, value] of Object.entries(strings)) {
      if (typeof value !== "string") continue;
      for (const figure of [live, ...stale]) {
        assert.ok(
          !new RegExp(String.raw`\b${figure}\b`).test(value),
          `${lang}.${key} hard-codes the action count ${figure}; use the placeholder`,
        );
      }
    }
  }
});
