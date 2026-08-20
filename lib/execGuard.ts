import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Server-side exec guard for API route handlers — the mirror of requireAdmin
 * (lib/adminGuard.ts), one tier down.
 *
 * Clears for "exec" AND "admin": admin is an exec-tier role with the extra
 * company-management privilege (see the role model at the top of
 * adminGuard.ts), so anything an exec may do, an admin may do too. That is the
 * one direction the two roles overlap.
 *
 * Same contract as requireAdmin: returns a NextResponse (401 or 403) if the
 * caller does not clear the gate, null if they do. Uses currentUser() rather
 * than sessionClaims so publicMetadata is always fresh and no custom JWT
 * template is needed, and reads the role only from Clerk — never from the
 * request body.
 *
 * Usage:
 *   const guard = await requireExec()
 *   if (guard) return guard
 */
export async function requireExec(): Promise<NextResponse | null> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await currentUser()
  const role = user?.publicMetadata?.role
  if (role !== 'exec' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: 360 access required' },
      { status: 403 },
    )
  }

  return null
}
