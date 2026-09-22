/**
 * What `llms-full.txt` says about the RFC 9728 document comes from data.
 *
 * GEO audit #4 (2026-09-22): the credential policy told agents that "both
 * scopes are advertised in the RFC 9728 document named by the 401 challenge"
 * while the live document advertised one. gitlab-mcp-server 3.1.0 had gone
 * back to a single scope on purpose (a client that reads the list asks GitLab
 * for all of it, and GitLab refuses a request naming a scope the application
 * lacks), and nothing tied the sentence to the document. Now the sentence is
 * built from `oauth.advertisedScopes`, `deploy-live-mcp.mjs` compares that
 * field with the live document after every deploy, and this pins the shape
 * the prose is written for.
 *
 * Read from the build like the other artifact tests (`DIST_DIR`, see
 * seo-artifacts.test.mjs): `src/lib/llms.ts` imports without extensions and
 * only loads inside Astro.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { servers } from "../../src/data/servers.ts";

const DIST = path.resolve(process.env.DIST_DIR ?? "dist");
const withOauth = servers.filter((server) => server.oauth);

test("every OAuth server declares what its RFC 9728 document advertises", () => {
  assert.ok(withOauth.length > 0, "no server declares oauth");
  for (const server of withOauth) {
    const { advertisedScopes, scopes } = server.oauth;
    assert.equal(
      advertisedScopes.length,
      1,
      `${server.id}: the document advertises ONE scope (upstream rule since 3.1.0); the prose is written for one`,
    );
    assert.ok(
      scopes.includes(advertisedScopes[0]),
      `${server.id}: the advertised scope ${advertisedScopes[0]} is not one the MCP application asks for`,
    );
  }
});

test("llms-full.txt describes the advertised scope from the data, never 'both'", () => {
  const full = fs.readFileSync(path.join(DIST, "llms-full.txt"), "utf8");
  for (const server of withOauth) {
    const [scope] = server.oauth.advertisedScopes;
    assert.ok(
      full.includes(`advertises exactly one\nscope, \`${scope}\``),
      `llms-full.txt does not name the advertised scope ${scope}`,
    );
  }
  assert.doesNotMatch(
    full,
    /both\s+scopes\s+are\s+advertised/i,
    "llms-full.txt claims the document advertises both scopes again",
  );
});
