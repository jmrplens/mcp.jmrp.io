import assert from "node:assert/strict";
import { test } from "node:test";

import { anchorSlug } from "../../src/lib/slug.ts";

test("a tool/prompt name that is already id-safe is lowercased and nothing else", () => {
  assert.equal(anchorSlug("gitlab_execute_action"), "gitlab-execute-action");
  assert.equal(anchorSlug("search"), "search");
});

test("a resource uri loses the scheme and the slashes, with no stray dashes", () => {
  assert.equal(
    anchorSlug("gitlab://guides/code-review"),
    "gitlab-guides-code-review",
  );
});

test("a uri template with parameter braces stays readable", () => {
  assert.equal(
    anchorSlug("gitlab://group/{group_id}/members"),
    "gitlab-group-group-id-members",
  );
});

test("it leaves no dangling dash at either end", () => {
  assert.equal(anchorSlug("://odd/"), "odd");
});
