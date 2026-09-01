// The idempotency guard's decision, as two pure functions.
//
// The guard itself lives in app/api/newsletter/generate/route.ts, where it
// cannot be tested — it needs a NextRequest and a live KV. The part worth
// testing is not the plumbing but the DECISION, so the decision is here and the
// route does nothing with it but obey.
//
// See the route for provenance: this exists because the endpoint was fired
// twice in ninety seconds on 2026-09-01 and generated two disagreeing
// newsletters over the top of each other.

/** Values of `?force=` that mean yes. Anything else — including absent — is no. */
const TRUTHY = ['1', 'true', 'yes'] as const;

/**
 * Did the caller explicitly ask to overwrite?
 *
 * Deliberately a small allow-list rather than a truthiness check. `?force=0`
 * and `?force=false` are the strings someone reaches for to turn a flag OFF,
 * and a naive `Boolean(raw)` treats both as ON — the guard would then be
 * disabled by the very parameter meant to leave it in place.
 */
export function isForceRequested(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string') return false;
  return (TRUTHY as readonly string[]).includes(raw.trim().toLowerCase());
}

/**
 * Refuse only when today's newsletter already exists and no override was given.
 *
 * The inversion is the whole check, so it is stated once here rather than
 * inline at the call site where a stray `!` reads as a typo.
 */
export function shouldRefuseGeneration(opts: {
  force: boolean;
  alreadyExists: boolean;
}): boolean {
  return opts.alreadyExists && !opts.force;
}
