/**
 * The fine-grained line of an action, as the domain pages and their Markdown
 * twins print it.
 *
 * Each case is a shape the committed snapshot actually holds (3.2.0, GitLab
 * 19.4.1): one permission at one boundary, two permissions on one line, one
 * permission at either of two boundaries, two lines one alternative needs,
 * alternatives of which any is enough, an alternative the grant does not
 * judge, the empty alternative `repository.archive` has, and a denial. The
 * reading is the upstream table's: a line holds all its permissions at one of
 * its boundaries, any one alternative is enough.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { getGitlabFineGrained } from "../../src/data/surface.ts";
import { serversPage } from "../../src/i18n/ui/servers-page.ts";
import {
  fineGrainedSegments,
  fineGrainedText,
} from "../../src/lib/fine-grained.ts";

const line = (permissions, at) => ({ permissions, at });
const oneOf = (...alternatives) => ({ any_of: alternatives });

const cases = [
  {
    name: "one permission at one boundary",
    entry: oneOf({ needs: [line(["Project: Read"], ["project"])] }),
    en: "Project: Read at project",
    es: "Project: Read en proyecto",
  },
  {
    name: "two permissions on one line",
    entry: oneOf({
      needs: [line(["Deployment: Read", "Merge Request: Read"], ["project"])],
    }),
    en: "Deployment: Read and Merge Request: Read at project",
    es: "Deployment: Read y Merge Request: Read en proyecto",
  },
  {
    name: "three permissions use commas before the last",
    entry: oneOf({
      needs: [line(["A: Read", "B: Read", "C: Read"], ["group"])],
    }),
    en: "A: Read, B: Read and C: Read at group",
    es: "A: Read, B: Read y C: Read en grupo",
  },
  {
    name: "one permission at either of two boundaries",
    entry: oneOf({
      needs: [line(["Access Request: Delete"], ["group", "user"])],
    }),
    en: "Access Request: Delete at group or user",
    es: "Access Request: Delete en grupo o usuario",
  },
  {
    name: "two lines one alternative needs",
    entry: oneOf({
      needs: [
        line(["Work Item: Read"], ["group"]),
        line(["Work Item: Delete"], ["group"]),
      ],
    }),
    en: "Work Item: Read at group + Work Item: Delete at group",
    es: "Work Item: Read en grupo + Work Item: Delete en grupo",
  },
  {
    name: "alternatives, any one enough",
    entry: oneOf(
      { needs: [line(["Global Search: Use"], ["project"])] },
      { needs: [line(["Global Search: Use"], ["instance"])] },
    ),
    en: "Global Search: Use at project or Global Search: Use at instance",
    es: "Global Search: Use en proyecto o Global Search: Use en instancia",
  },
  {
    name: "a request the grant does not judge",
    entry: oneOf({ not_judged_by_grant: true }),
    en: "not judged by the grant (GitLab authenticates this request another way)",
    es: "la concesión no lo juzga (GitLab autentica esta petición de otra forma)",
  },
  {
    name: "an alternative that needs no permission",
    entry: oneOf({ needs: [] }),
    en: "needs no permission",
    es: "no necesita ningún permiso",
  },
  {
    name: "a denial",
    entry: {
      denied: {
        cause: "graphql-type-undeclared",
        element: "X",
        effect: "refused",
      },
    },
    en: "none can run it at this GitLab release, which declares nothing for it; use a classic token",
    es: "ninguno puede ejecutarla en esta versión de GitLab, que no declara nada para ella; usa un token clásico",
  },
];

for (const c of cases) {
  test(`fine-grained line: ${c.name}`, () => {
    assert.equal(fineGrainedText(c.entry, serversPage.en), c.en);
    assert.equal(fineGrainedText(c.entry, serversPage.es), c.es);
  });
}

test("permission names stay apart from the words around them", () => {
  const entry = oneOf({
    needs: [line(["Deployment: Read", "Merge Request: Read"], ["project"])],
  });
  assert.deepEqual(fineGrainedSegments(entry, serversPage.en), [
    { permission: "Deployment: Read" },
    " and ",
    { permission: "Merge Request: Read" },
    " at project",
  ]);
  assert.equal(
    fineGrainedText(entry, serversPage.en, (p) => `\`${p}\``),
    "`Deployment: Read` and `Merge Request: Read` at project",
  );
});

test("the committed snapshot renders every action without a gap", () => {
  const snapshot = getGitlabFineGrained();
  assert.ok(snapshot, "src/data/surface/gitlab-fine-grained.json should load");
  for (const [id, entry] of Object.entries(snapshot.actions)) {
    for (const lang of ["en", "es"]) {
      const text = fineGrainedText(entry, serversPage[lang]);
      assert.ok(text.length > 0, `${id} (${lang}) renders empty`);
      assert.ok(!/undefined|\[object/.test(text), `${id} (${lang}): ${text}`);
    }
  }
});
