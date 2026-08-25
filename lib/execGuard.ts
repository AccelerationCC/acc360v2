import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

/**
 * Server-side exec guard for API route handlers — the mirror of requireAdmin
 * (lib/adminGuard.ts), one tier down.
 *
 * Clears for "exec", "superexec" and "king": admin is an exec-tier role with the
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
  if (!hasExecTier(user?.publicMetadata?.role)) {
    return NextResponse.json(
      { error: 'Forbidden: 360 access required' },
      { status: 403 },
    )
  }

  return null
}

/** Roles that clear the 360 gate. Single definition, used by both guards. */
export const EXEC_TIER_ROLES = ['exec', 'superexec', 'king', 'admin'] as const

/** Whether a role claim clears the 360 gate. `admin` is the deprecation bridge. */
export function hasExecTier(role: unknown): boolean {
  return typeof role === 'string' && (EXEC_TIER_ROLES as readonly string[]).includes(role)
}

/**
 * Page-level 360 gate — the server-side equivalent of requireExec, for React
 * Server Components rather than route handlers.
 *
 * Called from (dashboard)/layout.tsx, so it covers every dashboard page in one
 * place and runs BEFORE any content renders. Until this existed, ACC360 had no
 * role gate on viewing at all: middleware.ts only calls auth.protect(), which
 * is authentication, so any signed-in user — including an `hr` account or one
 * with no role — could browse the whole dashboard and read real company data.
 *
 * Redirects rather than returning a response, because that is how a Server
 * Component refuses. Signed-out users never reach here (middleware sends them
 * to /sign-in first); this is specifically "signed in, wrong tier".
 */
export async function ensureExecPage(): Promise<void> {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  if (!hasExecTier(user?.publicMetadata?.role)) redirect('/no-access')
}
