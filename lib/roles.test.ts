import { describe, expect, it } from 'vitest'
import { ADMIN_TIER_ROLES, hasAdminTier } from './roles'

// The admin rule was written out three times and they disagreed: requireAdmin
// admitted superexec|admin|king, while useAdmin and /companies/new admitted
// 'superexec' alone — so a king was allowed by the API but shown no controls
// and redirected off the page. These assertions are what keep the one
// definition honest now that all three call it.
describe('hasAdminTier', () => {
  it('admits superexec, king, and the admin bridge', () => {
    for (const role of ['superexec', 'king', 'admin']) {
      expect(hasAdminTier(role), `${role} should clear`).toBe(true)
    }
  })

  // THE PIN. Company management is the single privilege separating superexec
  // from exec. Widening this to admit exec erases the distinction — attempted
  // once and reverted; see the role model in adminGuard.ts.
  it("denies 'exec' — the distinction this predicate exists to hold", () => {
    expect(hasAdminTier('exec')).toBe(false)
  })

  it("denies 'hr' and no role at all", () => {
    for (const role of ['hr', null, undefined, '']) {
      expect(hasAdminTier(role)).toBe(false)
    }
  })

  // Guards non-string metadata explicitly, rather than relying on === to
  // happen to be false. A hand-edit in the Clerk dashboard can put anything
  // in publicMetadata.role.
  it('denies non-string values', () => {
    for (const role of [1, true, {}, ['superexec'], { role: 'king' }]) {
      expect(hasAdminTier(role)).toBe(false)
    }
  })

  it('is case-sensitive', () => {
    for (const role of ['SUPEREXEC', 'King', 'Admin', ' superexec']) {
      expect(hasAdminTier(role)).toBe(false)
    }
  })

  it('exposes exactly the three admitted roles', () => {
    expect([...ADMIN_TIER_ROLES]).toEqual(['superexec', 'admin', 'king'])
  })
})
