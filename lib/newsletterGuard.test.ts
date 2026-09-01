import { describe, expect, it } from 'vitest';
import { isForceRequested, shouldRefuseGeneration } from './newsletterGuard';

describe('isForceRequested', () => {
  it('accepts the documented affirmatives, case and space insensitive', () => {
    for (const raw of ['1', 'true', 'yes', 'TRUE', ' Yes ', 'True']) {
      expect(isForceRequested(raw)).toBe(true);
    }
  });

  it('treats absence as no', () => {
    expect(isForceRequested(null)).toBe(false);
    expect(isForceRequested(undefined)).toBe(false);
    expect(isForceRequested('')).toBe(false);
  });

  it('THE CONTROL: the off-switch strings must not read as ON', () => {
    // A truthiness implementation — `Boolean(raw)` — passes every assertion
    // above and fails every one of these, because a non-empty string is truthy.
    // Someone appending ?force=false to be explicit about NOT forcing would
    // silently disable the guard. This is the case that distinguishes the two
    // implementations, and it is the only reason the allow-list exists.
    for (const raw of ['0', 'false', 'no', 'off', 'nope']) {
      expect(isForceRequested(raw)).toBe(false);
    }
  });
});

describe('shouldRefuseGeneration', () => {
  it('refuses the repeat call — the case that actually happened', () => {
    expect(shouldRefuseGeneration({ force: false, alreadyExists: true })).toBe(true);
  });

  it('allows the ordinary daily run', () => {
    expect(shouldRefuseGeneration({ force: false, alreadyExists: false })).toBe(false);
  });

  it('allows a deliberate overwrite', () => {
    expect(shouldRefuseGeneration({ force: true, alreadyExists: true })).toBe(false);
  });

  it('THE CONTROL: a guard that always allows would pass three of four', () => {
    // `() => false` — the broken version, and the shape a dropped `!` or a
    // mis-wired call site produces — is correct on every row except the first.
    // Three green assertions out of four is what a disabled guard looks like,
    // so the first row is the one carrying the weight here.
    const alwaysAllows = () => false;
    const cases = [
      { force: false, alreadyExists: true },
      { force: false, alreadyExists: false },
      { force: true, alreadyExists: true },
      { force: true, alreadyExists: false },
    ];
    const real = cases.map((c) => shouldRefuseGeneration(c));
    const broken = cases.map(alwaysAllows);
    expect(real).not.toEqual(broken);
    expect(real.filter((r, i) => r === broken[i])).toHaveLength(3);
  });
});
