import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { requireExec } from '@/lib/execGuard'
import {
  EXEC_INVITE_ROLE,
  createExecInvitations,
  parseInviteEmails,
  type InvitationsClient,
} from '@/lib/execInvites'
import { recordInviteAudit } from '@/lib/inviteAudit'

/**
 * Self-service exec invitations — /api/invitations.
 *
 * Gated on role "exec" OR "superexec" (requireExec): an exec can invite another
 * exec, and an admin can too, since admin is an exec-tier role. What keeps
 * that safe is that the granted role is a server-side constant — this endpoint
 * can only ever grant "exec", so nobody can mint a second admin through it.
 * See EXEC_INVITE_ROLE in lib/execInvites.ts.
 *
 * Mirrors client-newsroom's /hr/api/admin/invitations, one tier over,
 * including the check order: authentication → input validation →
 * authorization.
 *
 * CLERK_SECRET_KEY is read only by the Clerk server SDK inside this handler.
 * Nothing here is exposed to the client; the route returns per-address results
 * and nothing else.
 */

// POST { emails: string[] } — a `role` field in the body is IGNORED.
export async function POST(req: NextRequest) {
  // ---- Step 1: authentication. Before anything else, including the body: an
  // unauthenticated caller gets a flat 401 whatever they sent. Validating
  // first would answer "this endpoint exists and wants an `emails` array" to
  // someone not yet shown to be anyone — describing the API to a stranger
  // before telling them they are not welcome.
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ---- Step 2: input validation.
  const body = await req.json().catch(() => null)
  const parsed = parseInviteEmails(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  // ---- Step 3: authorization. Does this user's tier allow inviting? A
  // separate call, not folded into step 1 — requireExec re-checks the session
  // itself, so this handler is safe even if middleware is bypassed entirely
  // (CVE-2025-29927) and even if step 1 were removed by a future edit.
  const guard = await requireExec()
  if (guard) return guard

  try {
    const client = await clerkClient()
    const result = await createExecInvitations(parsed.emails, {
      invitations: client.invitations as unknown as InvitationsClient,
      inviterUserId: userId,
      recordAudit: (entry) => recordInviteAudit(entry),
    })
    return NextResponse.json({ ...result, roleGranted: EXEC_INVITE_ROLE })
  } catch (err) {
    // Generic to the caller, detail to the server log — production responses
    // must not carry internals.
    console.error('[POST /api/invitations]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// GET — pending invitations, so a typo'd address can be spotted and revoked
// rather than sitting valid for 30 days.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const guard = await requireExec()
  if (guard) return guard

  try {
    const client = await clerkClient()
    const { data } = await client.invitations.getInvitationList({
      status: 'pending',
      limit: 100,
    })
    return NextResponse.json({
      invitations: data.map((inv) => ({
        id: inv.id,
        email: inv.emailAddress,
        role: (inv.publicMetadata?.role as string | undefined) ?? null,
        createdAt: inv.createdAt,
      })),
    })
  } catch (err) {
    console.error('[GET /api/invitations]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
