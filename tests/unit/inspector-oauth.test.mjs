/**
 * The inspector's "sign in with GitLab" button.
 *
 * It renders only when a server declares `oauth.inspector`, and for two weeks
 * gitlab did not: the block was commented out on 2026-08-28 because the
 * server then refused a `read_api` token at the door (-40300, "does not carry
 * the api scope that this deployment requires"), even on `initialize`. The
 * server was fixed the same day (ADR-0018: admission asks for the minimum
 * scope, writes are gated per action), but the comment waited for someone to
 * notice, and nothing here would have told them. The button just was not
 * there.
 *
 * So this pins the button's existence, and above all the property the whole
 * second application exists for: it asks for `read_api` and nothing else.
 * A web page holding a token that can write to someone's entire GitLab is the
 * outcome it was registered to avoid, and a slip back to `api` would go
 * unnoticed exactly the way the removal did.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { servers } from "../../src/data/servers.ts";
import { SITE_ORIGIN } from "../../src/lib/seo.ts";

const gitlab = servers.find((s) => s.id === "gitlab");

test("gitlab offers the inspector's sign-in button", () => {
  assert.ok(gitlab, "no gitlab entry in servers.ts");
  assert.ok(
    gitlab.oauth?.inspector,
    "gitlab has no oauth.inspector, so the inspector renders no sign-in button",
  );
});

test("the inspector's application asks for read_api and nothing more", () => {
  const inspector = gitlab?.oauth?.inspector;
  assert.ok(inspector, "no oauth.inspector to check");
  assert.deepEqual(
    inspector.scopes,
    ["read_api"],
    "the inspector must request read_api only: a write-capable token in a web page is what this application exists to avoid",
  );
  // A SECOND application, not the MCP clients' one. Reusing that one would
  // bring its `api` scope with it, whatever this list says.
  assert.notEqual(
    inspector.clientId,
    gitlab.oauth.clientId,
    "the inspector reuses the MCP clients' application, which is registered with api",
  );
});

test("the inspector redirects to the site's own callback page", () => {
  const inspector = gitlab?.oauth?.inspector;
  assert.ok(inspector, "no oauth.inspector to check");
  // GitLab matches the redirect URI character for character against the one
  // registered on the application, so it is ONE fixed URL for both
  // languages — /es/inspector/ redirects here too, which is why there is no
  // Spanish callback page and why a 404 there is expected.
  assert.equal(inspector.redirectUri, `${SITE_ORIGIN}/inspector/callback/`);
  assert.ok(
    fs.existsSync(
      new URL("../../src/pages/inspector/callback.astro", import.meta.url),
    ),
    "the callback page the redirect lands on is gone",
  );
});
