/**
 * The inspector's deep-link query parameters (`?server=&tab=&name=`).
 *
 * The URL is public and shareable — a docs page, a bookmark, a hand-edited
 * link — so every case here is either "valid input parses through" or
 * "invalid input drops silently to `undefined`", never a thrown error. See
 * `src/lib/inspector-deeplink.ts` for why `name` alone can't be fully
 * validated here (its catalog isn't loaded at parse time).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { servers } from "../../src/data/servers.ts";
import {
  isCatalogTab,
  parseDeepLink,
  TABS,
} from "../../src/lib/inspector-deeplink.ts";

test("the three valid parameters are read as they are", () => {
  const link = parseDeepLink(
    "?server=gitlab&tab=prompts&name=acquire_book",
    servers,
  );
  assert.deepEqual(link, {
    serverId: "gitlab",
    tab: "prompts",
    name: "acquire_book",
  });
});

test("with no query string, all three fall to undefined", () => {
  const link = parseDeepLink("", servers);
  assert.deepEqual(link, {
    serverId: undefined,
    tab: undefined,
    name: undefined,
  });
});

test("a server that is not in the list falls to undefined", () => {
  const link = parseDeepLink("?server=not-a-real-server", servers);
  assert.equal(link.serverId, undefined);
});

test("an empty server falls to undefined, not to an empty string", () => {
  const link = parseDeepLink("?server=", servers);
  assert.equal(link.serverId, undefined);
});

test("a tab that is not one of TABS falls to undefined", () => {
  const link = parseDeepLink("?tab=nope", servers);
  assert.equal(link.tab, undefined);
});

// Written out rather than read from TABS: a test that iterates the list it is
// checking would accept whatever the list happens to contain, including a tab
// that was dropped by accident.
test("every tab, catalogs and documents alike, is accepted", () => {
  for (const tab of [
    "tools",
    "prompts",
    "resources",
    "templates",
    "instructions",
    "server",
  ]) {
    assert.equal(parseDeepLink(`?tab=${tab}`, servers).tab, tab);
  }
});

test("TABS lists the catalogs before the documents", () => {
  assert.deepEqual(TABS, [
    "tools",
    "prompts",
    "resources",
    "templates",
    "instructions",
    "server",
  ]);
});

test("isCatalogTab separates the lists from the documents", () => {
  for (const tab of ["tools", "prompts", "resources", "templates"]) {
    assert.equal(isCatalogTab(tab), true, tab);
  }
  for (const tab of ["instructions", "server"]) {
    assert.equal(isCatalogTab(tab), false, tab);
  }
});

test("name is trimmed of spaces and an empty string falls to undefined", () => {
  assert.equal(parseDeepLink("?name=%20search%20", servers).name, "search");
  assert.equal(parseDeepLink("?name=", servers).name, undefined);
  assert.equal(parseDeepLink("?name=%20%20", servers).name, undefined);
});

test("one invalid parameter does not take down the other two, which are valid", () => {
  const link = parseDeepLink(
    "?server=not-a-real-server&tab=prompts&name=acquire_book",
    servers,
  );
  assert.deepEqual(link, {
    serverId: undefined,
    tab: "prompts",
    name: "acquire_book",
  });
});

test("an unrelated parameter (a token, say) does not appear in the result", () => {
  // There is no credential parameter this parser accepts: the URL never
  // carries the visitor's token. This checks it from the shape of the returned
  // object, which can only have these three keys.
  const link = parseDeepLink(
    "?server=gitlab&token=glpat-secret&Authorization=glpat-secret",
    servers,
  );
  assert.deepEqual(
    Object.keys(link).sort((a, b) => a.localeCompare(b)),
    ["name", "serverId", "tab"],
  );
  assert.equal(JSON.stringify(link).includes("glpat"), false);
});

test("it works the same with or without the leading `?`", () => {
  const withMark = parseDeepLink("?server=libgen", servers);
  const withoutMark = parseDeepLink("server=libgen", servers);
  assert.deepEqual(withMark, withoutMark);
});
