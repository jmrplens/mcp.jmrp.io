/**
 * The inspector's handbrake: how many calls in a row it takes before it
 * stops itself.
 *
 * WHAT THIS IS AND IS NOT. It is not a security control and must not be
 * presented as one: it runs in the caller's own browser, so anyone who wants
 * around it opens devtools, or just uses `curl`. What it prevents is what
 * actually happens — an impatient finger on "Run", a tab left with a key
 * held down, or this inspector being the most convenient remote control in
 * the world for hammering someone else's endpoint from a page that invites
 * you to try. The real control is upstream, in the vhost.
 *
 * All state is in memory, deliberately. A counter in localStorage would
 * survive a reload and be harder to shake off, but /policies/ and
 * /internals/ promise this page writes nothing to the browser, and that
 * promise is worth more than a slightly more stubborn limiter.
 *
 * The functions are pure and state is passed in and handed back, so a whole
 * sequence can be tested by supplying instants rather than faking clocks.
 */

/** The four numbers that define the brake. */
export interface LimiterConfig {
  /**
   * Minimum spacing between two calls OF THE SAME KIND.
   *
   * Same kind, deliberately. The first version applied this to any two calls
   * and it braked the ordinary sequence — load the tool list, pick one, run
   * it — because those land within a few hundred milliseconds of each other
   * and are all legitimate. What this is for is the double-click and the
   * held-down key, and both of those repeat one method.
   */
  minGapMs: number;
  /** Sliding window the calls are counted over. */
  windowMs: number;
  /** How many fit in that window before it counts as abuse. */
  maxInWindow: number;
  /** How long it stays blocked once that is exceeded. */
  cooldownMs: number;
}

/**
 * Defaults calibrated against human use, not against the server's ceiling.
 *
 * Someone poking at the inspector fires a call every few seconds: read the
 * answer, change an argument, try again. Ten in twenty seconds is already
 * faster than that and still bothers nobody; going past it takes intent. The
 * minimum gap is separate, and exists for the double-click and the held-down
 * Enter key.
 */
export const DEFAULT_LIMITS: LimiterConfig = {
  minGapMs: 400,
  windowMs: 20_000,
  maxInWindow: 10,
  cooldownMs: 15_000,
};

/** What the brake remembers between calls. */
export interface LimiterState {
  /** Timestamps of the calls inside the window. */
  recent: readonly number[];
  /** Instant it is blocked until; 0 when it is not. */
  cooldownUntil: number;
  /** The last call's kind, for the same-kind gap rule. */
  lastKey?: string;
}

/** Starting state, before the first call. */
export const initialLimiterState: LimiterState = {
  recent: [],
  cooldownUntil: 0,
};

/** Why a call was refused. */
export type DenyReason = "cooldown" | "gap" | "burst";

/** {@link attempt}'s verdict, with the state it leaves behind. */
export type Decision =
  | { allowed: true; state: LimiterState }
  | {
      allowed: false;
      reason: DenyReason;
      /** Milliseconds until it will accept a call again. */
      retryAfterMs: number;
      state: LimiterState;
    };

/**
 * Decides whether a call goes out, and returns the resulting state.
 *
 * Returning the state rather than mutating it is what lets a whole sequence
 * be tested by supplying instants by hand.
 *
 * @param state The previous state.
 * @param now This attempt's instant, in milliseconds.
 * @param key What kind of call this is; the gap rule only compares like
 *   with like, so chaining different methods is never braked.
 * @param config Limits to apply.
 * @returns The verdict and the next state.
 */
export function attempt(
  state: LimiterState,
  now: number,
  key: string,
  config: LimiterConfig = DEFAULT_LIMITS,
): Decision {
  // An open block outranks everything else: while it lasts, no other rule is
  // even consulted.
  if (state.cooldownUntil > now) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterMs: state.cooldownUntil - now,
      state,
    };
  }

  // Outside the window they stop counting. Pruned here rather than on record
  // so a refused attempt does not drag stale marks along either.
  const recent = state.recent.filter((at) => now - at < config.windowMs);
  const last = recent.at(-1);

  if (
    last !== undefined &&
    state.lastKey === key &&
    now - last < config.minGapMs
  ) {
    return {
      allowed: false,
      reason: "gap",
      retryAfterMs: config.minGapMs - (now - last),
      state: { ...state, recent },
    };
  }

  if (recent.length >= config.maxInWindow) {
    // Going over opens the block. The marks are dropped: coming out of it
    // starts from zero rather than one click away from falling back in.
    return {
      allowed: false,
      reason: "burst",
      retryAfterMs: config.cooldownMs,
      state: {
        recent: [],
        cooldownUntil: now + config.cooldownMs,
        lastKey: key,
      },
    };
  }

  return {
    allowed: true,
    state: { recent: [...recent, now], cooldownUntil: 0, lastKey: key },
  };
}
