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
import { parseDeepLink } from "../../src/lib/inspector-deeplink.ts";

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

test("a tab that is not tools/prompts/resources falls to undefined", () => {
  const link = parseDeepLink("?tab=nope", servers);
  assert.equal(link.tab, undefined);
});

test("the three valid tabs are accepted", () => {
  for (const tab of ["tools", "prompts", "resources"]) {
    assert.equal(parseDeepLink(`?tab=${tab}`, servers).tab, tab);
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
