import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Server-side exec guard for API route handlers — the mirror of requireAdmin
 * (lib/adminGuard.ts), one tier down.
 *
 * Clears for "exec", "admin" and "king": admin is an exec-tier role with the
 * extra company-management privilege, and king clears every gate in both apps
 * (see the five-row role model at the top of adminGuard.ts). Anything an exec
 * may do, an admin and a king may do too.
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
  if (role !== 'exec' && role !== 'admin' && role !== 'king') {
    return NextResponse.json(
      { error: 'Forbidden: 360 access required' },
      { status: 403 },
    )
  }

  return null
}
