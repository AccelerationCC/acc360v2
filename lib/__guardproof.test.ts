import { describe, expect, it } from 'vitest'
// TEMPORARY — proves the Checks job actually fails. Removed in the next commit.
describe('deliberate failure', () => {
  it('fails on purpose to prove the CI gate is real', () => {
    expect(1).toBe(2)
  })
})
