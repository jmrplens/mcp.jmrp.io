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

test("los tres parámetros válidos se leen tal cual", () => {
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

test("sin query string, los tres caen a undefined", () => {
  const link = parseDeepLink("", servers);
  assert.deepEqual(link, {
    serverId: undefined,
    tab: undefined,
    name: undefined,
  });
});

test("un server que no existe en la lista cae a undefined", () => {
  const link = parseDeepLink("?server=not-a-real-server", servers);
  assert.equal(link.serverId, undefined);
});

test("un server vacío cae a undefined, no a cadena vacía", () => {
  const link = parseDeepLink("?server=", servers);
  assert.equal(link.serverId, undefined);
});

test("una tab que no es tools/prompts/resources cae a undefined", () => {
  const link = parseDeepLink("?tab=nope", servers);
  assert.equal(link.tab, undefined);
});

test("las tres tabs válidas se aceptan", () => {
  for (const tab of ["tools", "prompts", "resources"]) {
    assert.equal(parseDeepLink(`?tab=${tab}`, servers).tab, tab);
  }
});

test("name se recorta de espacios y una cadena vacía cae a undefined", () => {
  assert.equal(
    parseDeepLink("?name=%20search%20", servers).name,
    "search",
  );
  assert.equal(parseDeepLink("?name=", servers).name, undefined);
  assert.equal(parseDeepLink("?name=%20%20", servers).name, undefined);
});

test("un parámetro inválido no tumba a los otros dos, que sí lo son", () => {
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

test("un parámetro ajeno (p. ej. un token) no aparece en el resultado", () => {
  // No existe ningún parámetro de credencial que este parser acepte: la URL
  // nunca lleva el token del visitante. Esto lo comprueba desde la forma del
  // objeto devuelto, que solo puede tener estas tres claves.
  const link = parseDeepLink(
    "?server=gitlab&token=glpat-secreto&Authorization=glpat-secreto",
    servers,
  );
  assert.deepEqual(
    Object.keys(link).sort((a, b) => a.localeCompare(b)),
    ["name", "serverId", "tab"],
  );
  assert.equal(JSON.stringify(link).includes("glpat"), false);
});

test("funciona igual con o sin el `?` inicial", () => {
  const withMark = parseDeepLink("?server=libgen", servers);
  const withoutMark = parseDeepLink("server=libgen", servers);
  assert.deepEqual(withMark, withoutMark);
});
