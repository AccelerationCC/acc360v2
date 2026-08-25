import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Clerk's server entry is stubbed: the point of these tests is which side of
// the guard a request lands on, and a real currentUser() call would need a live
// Clerk instance. Mirrors the approach in client-newsroom's hr-auth.test.ts.
const authMock = vi.fn()
const currentUserMock = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
  currentUser: currentUserMock,
}))

// Airtable is stubbed too, and asserting it was NEVER called is half the point:
// a 403 that still hit the base would mean the guard ran too late.
const setHotList = vi.fn()
const createCompany = vi.fn()
const deleteCompany = vi.fn()
vi.mock('./airtable', () => ({
  setHotList,
  createCompany,
  deleteCompany,
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  airtableError: () => ({ type: 'unknown', message: 'stub', status: 500 }),
}))

/** A signed-in Clerk session carrying `role` in publicMetadata. */
function signedInAs(role: string | null) {
  authMock.mockResolvedValue({ userId: 'user_abc' })
  currentUserMock.mockResolvedValue({
    id: 'user_abc',
    publicMetadata: role === null ? {} : { role },
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('requireAdmin', () => {
  it('lets "superexec" through — returns null, meaning "no objection"', async () => {
    const { requireAdmin } = await import('./adminGuard')
    signedInAs('superexec')
    await expect(requireAdmin()).resolves.toBeNull()
  })

  it('lets "king" through — king clears every gate in both apps', async () => {
    const { requireAdmin } = await import('./adminGuard')
    signedInAs('king')
    await expect(requireAdmin()).resolves.toBeNull()
  })

  // Guards the specific risk in adding a top-level role: that "king" was
  // implemented by loosening this comparison rather than adding a value.
  // "exec" and "hr" must be exactly as excluded as they were before.
  it('adding "king" did not loosen the guard for anyone else', async () => {
    const { requireAdmin } = await import('./adminGuard')
    for (const role of ['exec', 'hr', 'viewer', 'King', 'KING']) {
      signedInAs(role)
      const res = await requireAdmin()
      expect(res, `role ${role} must not clear the guard`).not.toBeNull()
      expect(res!.status).toBe(403)
    }
  })

  // THE PIN. "exec" is the 360-access role; managing companies is the one
  // privilege that separates "superexec" from "exec". If this test ever fails
  // because the predicate was widened to accept "exec", that widening is the
  // bug — it erases the only difference between the two roles. See the role
  // model at the top of adminGuard.ts.
  it('403s "exec" — company management is the admin-only privilege', async () => {
    const { requireAdmin } = await import('./adminGuard')
    signedInAs('exec')
    const res = await requireAdmin()
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it('403s "hr" and any unrecognised role', async () => {
    const { requireAdmin } = await import('./adminGuard')
    for (const role of ['hr', 'viewer', 'Superexec', 'SUPEREXEC']) {
      signedInAs(role)
      const res = await requireAdmin()
      expect(res, `role ${role} must not clear the guard`).not.toBeNull()
      expect(res!.status).toBe(403)
    }
  })

  it('403s a signed-in session with no role claim at all', async () => {
    const { requireAdmin } = await import('./adminGuard')
    signedInAs(null)
    const res = await requireAdmin()
    expect(res!.status).toBe(403)
  })

  it('401s an unauthenticated caller, before ever reading a role', async () => {
    const { requireAdmin } = await import('./adminGuard')
    authMock.mockResolvedValue({ userId: null })
    const res = await requireAdmin()
    expect(res!.status).toBe(401)
    expect(currentUserMock).not.toHaveBeenCalled()
  })
})

// The deprecation window for the admin → superexec rename. Pins both halves:
// the old string still clears the guard (so nobody tagged 'admin' in Clerk
// loses company management mid-migration) AND the tiers that never had this
// privilege still do not. When retagging is confirmed done, deleting the
// 'admin' case here is the signal that the OR clause in adminGuard.ts can go.
describe('requireAdmin during the admin → superexec deprecation window', () => {
  it("accepts the OLD 'admin' string — temporary bridge", async () => {
    const { requireAdmin } = await import('./adminGuard')
    signedInAs('admin')
    await expect(requireAdmin()).resolves.toBeNull()
  })

  it("accepts the NEW 'superexec' string", async () => {
    const { requireAdmin } = await import('./adminGuard')
    signedInAs('superexec')
    await expect(requireAdmin()).resolves.toBeNull()
  })

  it("accepts 'king'", async () => {
    const { requireAdmin } = await import('./adminGuard')
    signedInAs('king')
    await expect(requireAdmin()).resolves.toBeNull()
  })

  it("still rejects 'hr' and 'exec' — neither ever had this privilege", async () => {
    const { requireAdmin } = await import('./adminGuard')
    for (const role of ['hr', 'exec']) {
      signedInAs(role)
      const res = await requireAdmin()
      expect(res, `role ${role} must not clear the guard`).not.toBeNull()
      expect(res!.status).toBe(403)
    }
  })

  it('still rejects case variants and unknown roles', async () => {
    const { requireAdmin } = await import('./adminGuard')
    for (const role of ['Admin', 'ADMIN', 'Superexec', 'viewer']) {
      signedInAs(role)
      expect((await requireAdmin())!.status, `role ${role}`).toBe(403)
    }
  })
})

// The guard is only worth anything if the write routes actually call it, so
// these drive the real handlers rather than trusting the wiring.
describe('company write routes reject an exec', () => {
  // Next 15+ hands route handlers their params as a Promise.
  const params = { params: Promise.resolve({ id: 'recFAKE1234567890' }) }

  it('PATCH .../hotlist ACCEPTS a king, and reaches Airtable', async () => {
    const { PATCH } = await import('../app/api/companies/[id]/hotlist/route')
    signedInAs('king')
    setHotList.mockResolvedValueOnce({ id: 'recFAKE1234567890' })
    const res = await PATCH(
      new NextRequest('http://localhost/api/companies/recFAKE1234567890/hotlist', {
        method: 'PATCH',
        body: JSON.stringify({ onHotList: true }),
      }),
      params,
    )
    expect(res.status).toBe(200)
    expect(setHotList).toHaveBeenCalledWith('recFAKE1234567890', true)
  })

  it('PATCH /api/companies/[id]/hotlist → 403, and Airtable is never touched', async () => {
    const { PATCH } = await import('../app/api/companies/[id]/hotlist/route')
    signedInAs('exec')
    const res = await PATCH(
      new NextRequest('http://localhost/api/companies/recFAKE1234567890/hotlist', {
        method: 'PATCH',
        body: JSON.stringify({ onHotList: true }),
      }),
      params,
    )
    expect(res.status).toBe(403)
    expect(setHotList).not.toHaveBeenCalled()
  })

  it('POST /api/companies → 403, and Airtable is never touched', async () => {
    const { POST } = await import('../app/api/companies/route')
    signedInAs('exec')
    const res = await POST(
      new NextRequest('http://localhost/api/companies', {
        method: 'POST',
        body: JSON.stringify({ Company: 'Acme' }),
      }),
    )
    expect(res.status).toBe(403)
    expect(createCompany).not.toHaveBeenCalled()
  })

  it('DELETE /api/companies/[id] → 403, and Airtable is never touched', async () => {
    const { DELETE } = await import('../app/api/companies/[id]/route')
    signedInAs('exec')
    const res = await DELETE(
      new NextRequest('http://localhost/api/companies/recFAKE1234567890', {
        method: 'DELETE',
      }),
      params,
    )
    expect(res.status).toBe(403)
    expect(deleteCompany).not.toHaveBeenCalled()
  })
})
