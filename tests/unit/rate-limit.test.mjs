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

test("la primera llamada sale", () => {
  const d = attempt(initialLimiterState, 1000, "m", CFG);
  assert.equal(d.allowed, true);
  assert.deepEqual(d.state.recent, [1000]);
});

test("dos llamadas pegadas: la segunda se frena por el hueco mínimo", () => {
  const first = attempt(initialLimiterState, 1000, "m", CFG);
  const second = attempt(first.state, 1000 + CFG.minGapMs - 1, "m", CFG);
  assert.equal(second.allowed, false);
  assert.equal(second.reason, "gap");
  assert.equal(second.retryAfterMs, 1);
});

test("pasado el hueco mínimo vuelve a salir", () => {
  const first = attempt(initialLimiterState, 1000, "m", CFG);
  const second = attempt(first.state, 1000 + CFG.minGapMs, "m", CFG);
  assert.equal(second.allowed, true);
});

test("un frenazo por hueco NO consume cupo de la ventana", () => {
  // This matters: if a double-click spent quota, the brake itself would push
  // people towards the block instead of away from it.
  const first = attempt(initialLimiterState, 1000, "m", CFG);
  const denied = attempt(first.state, 1100, "m", CFG);
  assert.equal(denied.allowed, false);
  assert.deepEqual(denied.state.recent, [1000]);
});

test("pasarse del cupo de la ventana abre el bloqueo", () => {
  let state = initialLimiterState;
  let now = 0;
  for (let i = 0; i < CFG.maxInWindow; i++) {
    now += CFG.minGapMs;
    const d = attempt(state, now, "m", CFG);
    assert.equal(d.allowed, true, `la llamada ${i + 1} debería salir`);
    state = d.state;
  }

  now += CFG.minGapMs;
  const over = attempt(state, now, "m", CFG);
  assert.equal(over.allowed, false);
  assert.equal(over.reason, "burst");
  assert.equal(over.retryAfterMs, CFG.cooldownMs);
  assert.equal(over.state.cooldownUntil, now + CFG.cooldownMs);
});

test("durante el bloqueo se deniega todo, y el motivo lo dice", () => {
  const blocked = { recent: [], cooldownUntil: 5000 };
  const d = attempt(blocked, 4000, "m", CFG);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "cooldown");
  assert.equal(d.retryAfterMs, 1000);
});

test("al expirar el bloqueo se empieza de cero, no a un clic de recaer", () => {
  const blocked = { recent: [], cooldownUntil: 5000 };
  const d = attempt(blocked, 5000, "m", CFG);
  assert.equal(d.allowed, true);
  assert.deepEqual(d.state.recent, [5000]);
  assert.equal(d.state.cooldownUntil, 0);
});

test("la ventana desliza: llamadas viejas dejan de contar", () => {
  const old = Array.from({ length: CFG.maxInWindow }, (_, i) => i * 10);
  const state = { recent: old, cooldownUntil: 0 };
  // Well past the window: none of the earlier ones count any more.
  const d = attempt(state, CFG.windowMs + 1000, "m", CFG);
  assert.equal(d.allowed, true);
  assert.deepEqual(d.state.recent, [CFG.windowMs + 1000]);
});

test("un uso humano normal no se frena nunca", () => {
  // One call every three seconds for two minutes: read, change an argument,
  // try again. If this got braked, the brake would be wrong.
  let state = initialLimiterState;
  for (let now = 0; now < 120_000; now += 3000) {
    const d = attempt(state, now, "m", CFG);
    assert.equal(d.allowed, true, `frenada a los ${now}ms`);
    state = d.state;
  }
});

test("encadenar métodos distintos NO se frena: es el flujo normal", () => {
  // Load the tool list, pick one, run it. Those land within milliseconds of
  // each other and are all legitimate — braking them was the first version's
  // bug, and the e2e suite is what caught it.
  const first = attempt(initialLimiterState, 1000, "tools/list", CFG);
  assert.equal(first.allowed, true);
  const second = attempt(first.state, 1050, "tools/call", CFG);
  assert.equal(second.allowed, true, "un método distinto no debe frenarse");
});

test("repetir el MISMO método sí se frena: eso es el doble clic", () => {
  const first = attempt(initialLimiterState, 1000, "tools/list", CFG);
  const second = attempt(first.state, 1050, "tools/list", CFG);
  assert.equal(second.allowed, false);
  assert.equal(second.reason, "gap");
});
