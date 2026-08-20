import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// ============================================================================
// THE ROLE MODEL — five roles. "superexec" is NOT a superuser; "king" is.
//
//   role        HR desk (newsroom /hr)   360 / this app   manage companies
//   ----------  -----------------------  ---------------  ----------------
//   (none)      no                       no               no
//   "hr"        YES                      no               no
//   "exec"      no                       YES              no
//   "superexec"     no                       YES              YES
//   "king"      YES                      YES              YES
//
// Two facts, easy to conflate:
//
//  1. "superexec" means "exec access, plus the company-management privilege" — an
//     exec-tier role with one extra power, NOT a role that sees every portal.
//     An admin has no HR access at all; the newsroom's hasHrAccess
//     (client-newsroom/src/lib/hr-auth.ts) denies it deliberately.
//
//  2. "king" IS the top of everything, and the only role that is. It clears
//     every gate in both apps — HR desk, /360, company management. If you add
//     a new gate, "king" belongs in it.
//
// So: king ⊃ {hr}, king ⊃ {exec}, king ⊃ {admin} — but admin ⊅ hr. Only
// "king" spans both tiers. It exists as a separate value rather than as a
// widening of "superexec" precisely so that "superexec" keeps meaning exactly one
// thing: exec + company management, no HR.
//
// requireAdmin below is the ONLY place the company-management privilege is
// enforced, for the whole two-app system. It gates exactly: POST /api/companies,
// PATCH + DELETE /api/companies/[id], and PATCH /api/companies/[id]/hotlist.
//
// "exec" must NOT clear this guard. An exec can read the 360 app; managing
// companies is the one thing that separates "superexec" from "exec", so widening
// this predicate to accept "exec" erases the only distinction between the two
// roles. That was attempted once and reverted — see MERGE_LOG.md, 2026-08-20.
// Pinned by lib/adminGuard.test.ts.
//
// "king" is deliberately not grantable in-app: neither invite endpoint can
// issue it (EXEC_INVITE_ROLE = "exec", HR_INVITE_ROLE = "hr"), so a king can
// only be minted by hand in the Clerk dashboard. A role that clears
// everything should not be reachable by a button.
// ============================================================================

/**
 * Server-side admin guard for API route handlers.
 * Returns a NextResponse (401 or 403) if the caller clears neither "superexec"
 * nor "king"; null if they do.
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
  const role = user?.publicMetadata?.role
  if (role !== 'superexec' && role !== 'king') {
    return NextResponse.json(
      { error: 'Forbidden: admin access required' },
      { status: 403 },
    )
  }

  return null
}
