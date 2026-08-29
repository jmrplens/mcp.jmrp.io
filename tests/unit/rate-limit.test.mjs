import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attempt,
  DEFAULT_LIMITS,
  initialLimiterState,
} from "../../src/lib/rate-limit.ts";

/**
 * The brake is tested by supplying instants by hand, which is exactly why
 * `attempt` returns state instead of mutating it: no fake clocks here, and no
 * twenty-second waits.
 */

const CFG = DEFAULT_LIMITS;

test("the first call goes through", () => {
  const d = attempt(initialLimiterState, 1000, "m", CFG);
  assert.equal(d.allowed, true);
  assert.deepEqual(d.state.recent, [1000]);
});

test("two calls back to back: the second is braked by the minimum gap", () => {
  const first = attempt(initialLimiterState, 1000, "m", CFG);
  const second = attempt(first.state, 1000 + CFG.minGapMs - 1, "m", CFG);
  assert.equal(second.allowed, false);
  assert.equal(second.reason, "gap");
  assert.equal(second.retryAfterMs, 1);
});

test("past the minimum gap it goes through again", () => {
  const first = attempt(initialLimiterState, 1000, "m", CFG);
  const second = attempt(first.state, 1000 + CFG.minGapMs, "m", CFG);
  assert.equal(second.allowed, true);
});

test("a gap brake does NOT spend window quota", () => {
  // This matters: if a double-click spent quota, the brake itself would push
  // people towards the block instead of away from it.
  const first = attempt(initialLimiterState, 1000, "m", CFG);
  const denied = attempt(first.state, 1100, "m", CFG);
  assert.equal(denied.allowed, false);
  assert.deepEqual(denied.state.recent, [1000]);
});

test("going over the window quota opens the cooldown", () => {
  let state = initialLimiterState;
  let now = 0;
  for (let i = 0; i < CFG.maxInWindow; i++) {
    now += CFG.minGapMs;
    const d = attempt(state, now, "m", CFG);
    assert.equal(d.allowed, true, `call ${i + 1} should go through`);
    state = d.state;
  }

  now += CFG.minGapMs;
  const over = attempt(state, now, "m", CFG);
  assert.equal(over.allowed, false);
  assert.equal(over.reason, "burst");
  assert.equal(over.retryAfterMs, CFG.cooldownMs);
  assert.equal(over.state.cooldownUntil, now + CFG.cooldownMs);
});

test("everything is denied during the cooldown, and the reason says so", () => {
  const blocked = { recent: [], cooldownUntil: 5000 };
  const d = attempt(blocked, 4000, "m", CFG);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "cooldown");
  assert.equal(d.retryAfterMs, 1000);
});

test("when the cooldown expires it starts from zero, not one click from relapsing", () => {
  const blocked = { recent: [], cooldownUntil: 5000 };
  const d = attempt(blocked, 5000, "m", CFG);
  assert.equal(d.allowed, true);
  assert.deepEqual(d.state.recent, [5000]);
  assert.equal(d.state.cooldownUntil, 0);
});

test("the window slides: old calls stop counting", () => {
  const old = Array.from({ length: CFG.maxInWindow }, (_, i) => i * 10);
  const state = { recent: old, cooldownUntil: 0 };
  // Well past the window: none of the earlier ones count any more.
  const d = attempt(state, CFG.windowMs + 1000, "m", CFG);
  assert.equal(d.allowed, true);
  assert.deepEqual(d.state.recent, [CFG.windowMs + 1000]);
});

test("ordinary human use is never braked", () => {
  // One call every three seconds for two minutes: read, change an argument,
  // try again. If this got braked, the brake would be wrong.
  let state = initialLimiterState;
  for (let now = 0; now < 120_000; now += 3000) {
    const d = attempt(state, now, "m", CFG);
    assert.equal(d.allowed, true, `braked at ${now}ms`);
    state = d.state;
  }
});

test("chaining different methods is NOT braked: that is the normal flow", () => {
  // Load the tool list, pick one, run it. Those land within milliseconds of
  // each other and are all legitimate — braking them was the first version's
  // bug, and the e2e suite is what caught it.
  const first = attempt(initialLimiterState, 1000, "tools/list", CFG);
  assert.equal(first.allowed, true);
  const second = attempt(first.state, 1050, "tools/call", CFG);
  assert.equal(second.allowed, true, "a different method must not be braked");
});

test("repeating the SAME method is braked: that is the double click", () => {
  const first = attempt(initialLimiterState, 1000, "tools/list", CFG);
  const second = attempt(first.state, 1050, "tools/list", CFG);
  assert.equal(second.allowed, false);
  assert.equal(second.reason, "gap");
});
