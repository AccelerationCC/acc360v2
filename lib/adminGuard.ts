import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// ============================================================================
// THE ROLE MODEL — four roles, and "admin" is NOT a superuser.
//
//   role        HR desk (client-newsroom /hr)   360 / this app   manage companies
//   ----------  -----------------------------   --------------   ----------------
//   (none)      no                              no               no
//   "hr"        YES                             no               no
//   "exec"      no                              YES              no
//   "admin"     no                              YES              YES
//
// "admin" means "exec access, plus the company-management privilege" — an
// exec-tier role with one extra power, NOT a role that sees every portal. An
// admin has no HR access at all; that lives in the newsroom's hasHrAccess
// (client-newsroom/src/lib/hr-auth.ts), which denies "admin" on purpose.
//
// requireAdmin below is the ONLY place the company-management privilege is
// enforced, for the whole two-app system. It gates exactly: POST /api/companies,
// PATCH + DELETE /api/companies/[id], and PATCH /api/companies/[id]/hotlist.
//
// "exec" must NOT clear this guard. An exec can read the 360 app; managing
// companies is the one thing that separates "admin" from "exec", so widening
// this predicate to accept "exec" erases the only distinction between the two
// roles. That was attempted once and reverted — see MERGE_LOG.md, 2026-08-20.
// Pinned by lib/adminGuard.test.ts.
// ============================================================================

/**
 * Server-side admin guard for API route handlers.
 * Returns a NextResponse (401 or 403) if the caller is not an admin; null if they are.
 *
 * Usage in a write handler:
 *   const guard = await requireAdmin()
 *   if (guard) return guard
 *
 * Uses currentUser() (not sessionClaims) so publicMetadata is always fresh
 * and no custom JWT template is required in Clerk.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await currentUser()
  if (user?.publicMetadata?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: admin access required' },
      { status: 403 },
    )
  }

  return null
}
