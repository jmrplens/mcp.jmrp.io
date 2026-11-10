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

import {
  actionCatalogs,
  catalogTierMismatch,
  GITLAB_CATALOG_NOTE,
  GITLAB_CATALOG_TIER,
  GITLAB_ULTIMATE_ONLY_DOMAINS,
} from "../../src/data/surface.ts";
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

// The tier is the other half of the figure, and the manifest never names it.
// It was Free up to gitlab 3.2.0 and Ultimate from 3.3.0 on, with the same
// token, because 3.3.0 began reading the tier from the groups a token belongs
// to (#1273); six strings said "Free-tier" over a catalog of 977 Ultimate
// actions until 2026-10-24. GITLAB_ULTIMATE_ONLY_DOMAINS exist only on
// Ultimate, so the catalog itself says which tier it was counted at.
test("the tier the copy names is the tier the committed catalog shows", () => {
  const domains = actionCatalogs().gitlab.domains.map((d) => d.domain);
  assert.equal(catalogTierMismatch(domains), undefined);
});

// The same check gates the build's sync, which is where a wrong tier gets
// in: these cases pin what it accepts and what it refuses.
test("catalogTierMismatch accepts a catalog that matches its tier", () => {
  const ultimate = ["issue", ...GITLAB_ULTIMATE_ONLY_DOMAINS];
  assert.equal(catalogTierMismatch(ultimate, "Ultimate"), undefined);
  assert.equal(catalogTierMismatch(["issue", "epic"], "Free"), undefined);
  assert.equal(catalogTierMismatch(["issue", "epic"], "Premium"), undefined);
});

test("catalogTierMismatch refuses an Ultimate claim over a lower catalog", () => {
  const reason = catalogTierMismatch(["issue", "vulnerability"], "Ultimate");
  assert.match(reason ?? "", /lacks the Ultimate-only domains/);
  assert.match(reason ?? "", /dora_metrics/);
  assert.doesNotMatch(reason ?? "", /vulnerability/);
});

test("catalogTierMismatch refuses a lower claim over an Ultimate catalog", () => {
  const reason = catalogTierMismatch(["issue", "dora_metrics"], "Free");
  assert.match(reason ?? "", /carries the Ultimate-only domains dora_metrics/);
});

test("every string that states the tier states GITLAB_CATALOG_TIER", () => {
  assert.ok(GITLAB_CATALOG_NOTE.includes(GITLAB_CATALOG_TIER));
  for (const [lang, strings] of Object.entries(serversPage)) {
    for (const key of ["mdCatalogBody", "catalogTokenNote"]) {
      assert.ok(
        strings[key].includes(GITLAB_CATALOG_TIER),
        `${lang}.${key} does not name the ${GITLAB_CATALOG_TIER} tier`,
      );
      assert.ok(
        // cspell:ignore Contado -- the Spanish note's old opening, matched
        // here only as the thing it must no longer say.
        !/Free-tier token|Contado con un token Free/.test(strings[key]),
        `${lang}.${key} still says the catalog was counted on Free`,
      );
    }
  }
});
