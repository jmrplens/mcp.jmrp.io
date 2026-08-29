import assert from "node:assert/strict";
import { test } from "node:test";

import { anchorSlug } from "../../src/lib/slug.ts";

test("un nombre de tool/prompt ya id-safe pasa a minúsculas sin más cambios", () => {
  assert.equal(anchorSlug("gitlab_execute_action"), "gitlab-execute-action");
  assert.equal(anchorSlug("search"), "search");
});

test("una uri de resource pierde el esquema y las barras, sin guiones sueltos", () => {
  assert.equal(
    anchorSlug("gitlab://guides/code-review"),
    "gitlab-guides-code-review",
  );
});

test("una uri template con llaves de parámetro queda legible", () => {
  assert.equal(
    anchorSlug("gitlab://group/{group_id}/members"),
    "gitlab-group-group-id-members",
  );
});

test("no deja guion colgando ni al principio ni al final", () => {
  assert.equal(anchorSlug("://raro/"), "raro");
});
