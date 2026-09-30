import assert from "node:assert/strict";
import { test } from "node:test";

import { mapWithConcurrency } from "../../src/integrations/post-build/utils.ts";

/**
 * The post-build passes (compression, HTML) run through this window. What
 * matters to them: every file is processed once, results come back in input
 * order whatever finishes first, and no more than `limit` run at once.
 */
test("keeps input order and never exceeds the limit", async () => {
  let running = 0;
  let peak = 0;
  const items = [30, 5, 20, 1, 15, 10, 2];
  const results = await mapWithConcurrency(items, 3, async (ms) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, ms));
    running--;
    return ms * 2;
  });
  assert.deepEqual(
    results,
    items.map((ms) => ms * 2),
  );
  assert.equal(peak, 3);
});

test("an empty list and a limit below one both work", async () => {
  assert.deepEqual(await mapWithConcurrency([], 4, async (x) => x), []);
  assert.deepEqual(
    await mapWithConcurrency([1, 2], 0, async (x) => x + 1),
    [2, 3],
  );
});

test("a failure rejects the whole map", async () => {
  await assert.rejects(
    mapWithConcurrency([1, 2, 3], 2, async (x) => {
      if (x === 2) throw new Error("boom");
      return x;
    }),
    /boom/,
  );
});
