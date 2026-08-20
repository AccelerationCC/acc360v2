import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Clerk's server entry is stubbed — these tests are about which side of the
// gate a request lands on, not about Clerk itself. Mirrors adminGuard.test.ts.
const authMock = vi.fn()
const currentUserMock = vi.fn()
const createInvitation = vi.fn(async () => ({}))
const getInvitationList = vi.fn(async () => ({ data: [] }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
  currentUser: currentUserMock,
  clerkClient: () => ({ invitations: { createInvitation, getInvitationList } }),
}))

// KV is stubbed: asserting the audit write happened without touching Vercel.
const auditWrites: unknown[] = []
vi.mock('./inviteAudit', () => ({
  recordInviteAudit: async (entry: unknown) => {
    auditWrites.push(entry)
  },
}))

function signedInAs(role: string | null, userId = 'user_abc') {
  authMock.mockResolvedValue({ userId })
  currentUserMock.mockResolvedValue({
    id: userId,
    publicMetadata: role === null ? {} : { role },
  })
}

function inviteRequest(body: unknown) {
  return new NextRequest('http://localhost/api/invitations', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.clearAllMocks()
  auditWrites.length = 0
})

describe('requireExec', () => {
  it('lets "exec" through', async () => {
    const { requireExec } = await import('./execGuard')
    signedInAs('exec')
    await expect(requireExec()).resolves.toBeNull()
  })

  it('lets "admin" through — admin is an exec-tier role', async () => {
    const { requireExec } = await import('./execGuard')
    signedInAs('admin')
    await expect(requireExec()).resolves.toBeNull()
  })

  it('403s "hr" and any unrecognised role', async () => {
    const { requireExec } = await import('./execGuard')
    for (const role of ['hr', 'viewer', 'Exec', 'EXEC']) {
      signedInAs(role)
      const res = await requireExec()
      expect(res, `role ${role} must not clear the gate`).not.toBeNull()
      expect(res!.status).toBe(403)
    }
  })

  it('403s a signed-in session with no role claim', async () => {
    const { requireExec } = await import('./execGuard')
    signedInAs(null)
    expect((await requireExec())!.status).toBe(403)
  })

  it('401s an unauthenticated caller before reading a role', async () => {
    const { requireExec } = await import('./execGuard')
    authMock.mockResolvedValue({ userId: null })
    expect((await requireExec())!.status).toBe(401)
    expect(currentUserMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/invitations — the three steps, in order', () => {
  // Step 1 is authentication, so the body is irrelevant to an anonymous
  // caller: both of these are a flat 401. The malformed-body case is the
  // interesting one — a 400 here would confirm the endpoint exists and wants
  // an `emails` array before confirming who is asking.
  it('401s an unauthenticated caller with a MALFORMED body — not 400', async () => {
    const { POST } = await import('@/app/api/invitations/route')
    authMock.mockResolvedValue({ userId: null })
    const res = await POST(inviteRequest({ nope: true }))
    expect(res.status).toBe(401)
    expect(createInvitation).not.toHaveBeenCalled()
  })

  it('401s an unauthenticated caller with a valid body', async () => {
    const { POST } = await import('@/app/api/invitations/route')
    authMock.mockResolvedValue({ userId: null })
    const res = await POST(inviteRequest({ emails: ['a@example.com'] }))
    expect(res.status).toBe(401)
    expect(createInvitation).not.toHaveBeenCalled()
  })

  it('gives an anonymous caller the SAME response either way', async () => {
    const { POST } = await import('@/app/api/invitations/route')
    authMock.mockResolvedValue({ userId: null })
    const malformed = await POST(inviteRequest({ nope: true }))
    const valid = await POST(inviteRequest({ emails: ['a@example.com'] }))
    expect(malformed.status).toBe(valid.status)
    await expect(malformed.json()).resolves.toEqual(await valid.json())
  })

  it('400s a malformed body once the caller IS authenticated (step 2)', async () => {
    const { POST } = await import('@/app/api/invitations/route')
    signedInAs('exec')
    const res = await POST(inviteRequest({ nope: true }))
    expect(res.status).toBe(400)
    expect(createInvitation).not.toHaveBeenCalled()
  })

  // A signed-in caller who fails the ROLE check still sees validation first —
  // they are a known user, so the body's shape is not a secret from them.
  it('400s a malformed body from a signed-in non-exec, 403s a valid one', async () => {
    const { POST } = await import('@/app/api/invitations/route')
    signedInAs('hr')
    expect((await POST(inviteRequest({ nope: true }))).status).toBe(400)
    expect((await POST(inviteRequest({ emails: ['a@example.com'] }))).status).toBe(403)
    expect(createInvitation).not.toHaveBeenCalled()
  })

  it('403s an "hr" caller with a valid body (step 3), sending and auditing nothing', async () => {
    const { POST } = await import('@/app/api/invitations/route')
    signedInAs('hr')
    const res = await POST(inviteRequest({ emails: ['a@example.com'] }))
    expect(res.status).toBe(403)
    expect(createInvitation).not.toHaveBeenCalled()
    expect(auditWrites).toHaveLength(0)
  })

  it('an exec invites, and Clerk is asked for role "exec" only', async () => {
    const { POST } = await import('@/app/api/invitations/route')
    signedInAs('exec', 'user_exec')
    const res = await POST(inviteRequest({ emails: ['new@example.com'], role: 'admin' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ sent: 1, failed: 0, roleGranted: 'exec' })
    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: 'new@example.com',
      publicMetadata: { role: 'exec' },
      notify: true,
    })
    // ...and the audit row carries the real inviter, from the session.
    expect(auditWrites).toEqual([
      { inviterUserId: 'user_exec', inviteeEmail: 'new@example.com', roleGranted: 'exec' },
    ])
  })

  it('an admin can invite too, and still only grants "exec"', async () => {
    const { POST } = await import('@/app/api/invitations/route')
    signedInAs('admin', 'user_scott')
    const res = await POST(inviteRequest({ emails: ['new@example.com'], role: 'admin' }))
    expect(res.status).toBe(200)
    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ publicMetadata: { role: 'exec' } }),
    )
    expect(auditWrites).toEqual([
      { inviterUserId: 'user_scott', inviteeEmail: 'new@example.com', roleGranted: 'exec' },
    ])
  })
})

describe('GET /api/invitations', () => {
  it('403s "hr" and allows "exec"', async () => {
    const { GET } = await import('@/app/api/invitations/route')
    signedInAs('hr')
    expect((await GET()).status).toBe(403)
    signedInAs('exec')
    expect((await GET()).status).toBe(200)
  })
})
