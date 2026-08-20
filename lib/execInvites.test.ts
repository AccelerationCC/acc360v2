import { describe, expect, it, vi } from 'vitest'
import {
  EXEC_INVITE_ROLE,
  buildInvitationParams,
  createExecInvitations,
  isValidInviteEmail,
  parseInviteEmails,
  type InvitationParams,
} from './execInvites'
import { AUDIT_MAX, listInviteAudit, recordInviteAudit, type InviteAuditEntry } from './inviteAudit'

/** Records every payload handed to Clerk so tests can assert on it. */
function fakeInvitations(opts: { failFor?: string[] } = {}) {
  const calls: InvitationParams[] = []
  return {
    calls,
    createInvitation: async (params: InvitationParams) => {
      calls.push(params)
      if (opts.failFor?.includes(params.emailAddress)) {
        throw { errors: [{ longMessage: 'already invited' }] }
      }
      return {}
    },
  }
}

function deps(invitations: ReturnType<typeof fakeInvitations>, over: Record<string, unknown> = {}) {
  return {
    invitations,
    inviterUserId: 'user_inviter',
    recordAudit: vi.fn(async () => {}),
    ...over,
  } as Parameters<typeof createExecInvitations>[1] & { recordAudit: ReturnType<typeof vi.fn> }
}

// ============================================================================
// THE PIN. requireExec admits "exec" AND "admin", so if the granted role came
// from the request body an exec could POST {"role":"admin"} and mint a second
// admin — handing themselves the company-management privilege that is the only
// thing separating the two roles. The role is a module constant instead.
// ============================================================================
describe('the invited role is server-side and cannot be influenced by input', () => {
  it('always attaches publicMetadata.role = "exec"', async () => {
    const invitations = fakeInvitations()
    await createExecInvitations(['jane@example.com'], deps(invitations))
    expect(invitations.calls).toEqual([
      { emailAddress: 'jane@example.com', publicMetadata: { role: 'exec' }, notify: true },
    ])
  })

  it('never grants "admin", whatever the caller sends', async () => {
    for (const smuggled of ['admin', 'ADMIN', ['admin'], { role: 'admin' }, null, 0, true]) {
      const parsed = parseInviteEmails({ emails: ['jane@example.com'], role: smuggled })
      expect(parsed).toEqual({ ok: true, emails: ['jane@example.com'] })
      expect(JSON.stringify(parsed)).not.toContain('admin')

      const invitations = fakeInvitations()
      if (!parsed.ok) continue
      await createExecInvitations(parsed.emails, deps(invitations))
      for (const p of invitations.calls) {
        expect(p.publicMetadata).toEqual({ role: 'exec' })
        expect(p.publicMetadata.role).not.toBe('admin')
      }
    }
  })

  it('exposes the granted role as the literal "exec", so a widening is a visible diff', () => {
    expect(EXEC_INVITE_ROLE).toBe('exec')
    expect(buildInvitationParams('x@example.com').publicMetadata.role).toBe('exec')
  })
})

describe('parseInviteEmails', () => {
  it('normalises, dedupes and drops blanks', () => {
    expect(parseInviteEmails({ emails: ['  Jane@Example.com ', 'jane@example.com', ' '] })).toEqual({
      ok: true,
      emails: ['jane@example.com'],
    })
  })

  it('rejects a non-array, an empty list and an oversized batch', () => {
    expect(parseInviteEmails({ emails: 'x@example.com' }).ok).toBe(false)
    expect(parseInviteEmails({ emails: [] })).toEqual({
      ok: false,
      error: 'at least one email is required',
    })
    expect(parseInviteEmails(null).ok).toBe(false)
    expect(parseInviteEmails({ emails: Array.from({ length: 26 }, (_, i) => `u${i}@e.com`) })).toEqual(
      { ok: false, error: 'at most 25 invitations per batch' },
    )
  })
})

describe('isValidInviteEmail', () => {
  it('accepts ordinary addresses and rejects malformed ones', () => {
    for (const ok of ['a@b.com', 'first.last@sub.example.co.uk']) {
      expect(isValidInviteEmail(ok), ok).toBe(true)
    }
    for (const bad of ['nope', 'a@b', 'a@@b.com', 'a b@c.com', '@b.com', 'a@.com', '']) {
      expect(isValidInviteEmail(bad), bad).toBe(false)
    }
    expect(isValidInviteEmail(`${'a'.repeat(250)}@b.com`)).toBe(false)
  })
})

describe('createExecInvitations', () => {
  it('reports malformed addresses per-address and never sends them', async () => {
    const invitations = fakeInvitations()
    const result = await createExecInvitations(['good@example.com', 'nope'], deps(invitations))
    expect(result.sent).toBe(1)
    expect(result.failed).toBe(1)
    expect(invitations.calls.map((p) => p.emailAddress)).toEqual(['good@example.com'])
  })

  it('one rejected address does not stop the rest of the batch', async () => {
    const invitations = fakeInvitations({ failFor: ['taken@example.com'] })
    const result = await createExecInvitations(
      ['a@example.com', 'taken@example.com', 'b@example.com'],
      deps(invitations),
    )
    expect(result.sent).toBe(2)
    expect(result.results).toContainEqual({
      email: 'taken@example.com',
      status: 'failed',
      error: 'already invited',
    })
  })
})

describe('audit trail', () => {
  it('writes one entry per sent invitation, with the inviter from the session', async () => {
    const invitations = fakeInvitations()
    const d = deps(invitations)
    await createExecInvitations(['a@example.com', 'b@example.com'], d)
    expect(d.recordAudit).toHaveBeenCalledTimes(2)
    expect(d.recordAudit).toHaveBeenCalledWith({
      inviterUserId: 'user_inviter',
      inviteeEmail: 'a@example.com',
      roleGranted: 'exec',
    })
  })

  it('writes no entry for an address that failed', async () => {
    const invitations = fakeInvitations({ failFor: ['taken@example.com'] })
    const d = deps(invitations)
    await createExecInvitations(['taken@example.com'], d)
    expect(d.recordAudit).not.toHaveBeenCalled()
  })

  it('still reports the invite as sent when the audit write throws', async () => {
    const invitations = fakeInvitations()
    const result = await createExecInvitations(['a@example.com'], {
      ...deps(invitations),
      recordAudit: async () => {
        throw new Error('kv down')
      },
    })
    expect(result.sent).toBe(1)
  })

  it('records the four audited facts, newest first', async () => {
    // Hand-rolled KV fake — no live Vercel KV.
    let stored: InviteAuditEntry[] | null = null
    const store = {
      get: async <T>() => stored as T | null,
      set: async (_k: string, v: unknown) => {
        stored = v as InviteAuditEntry[]
      },
    }
    const at = (iso: string) => () => new Date(iso)
    await recordInviteAudit(
      { inviterUserId: 'user_1', inviteeEmail: 'first@example.com', roleGranted: 'exec' },
      { store, now: at('2026-08-20T10:00:00.000Z') },
    )
    await recordInviteAudit(
      { inviterUserId: 'user_2', inviteeEmail: 'second@example.com', roleGranted: 'exec' },
      { store, now: at('2026-08-20T11:00:00.000Z') },
    )
    expect(await listInviteAudit(store)).toEqual([
      {
        inviterUserId: 'user_2',
        inviteeEmail: 'second@example.com',
        roleGranted: 'exec',
        createdAt: '2026-08-20T11:00:00.000Z',
      },
      {
        inviterUserId: 'user_1',
        inviteeEmail: 'first@example.com',
        roleGranted: 'exec',
        createdAt: '2026-08-20T10:00:00.000Z',
      },
    ])
  })

  it(`caps the trail at ${AUDIT_MAX} entries, dropping the oldest`, async () => {
    let stored: InviteAuditEntry[] | null = Array.from({ length: AUDIT_MAX }, (_, i) => ({
      inviterUserId: 'user_old',
      inviteeEmail: `old${i}@example.com`,
      roleGranted: 'exec',
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    const store = {
      get: async <T>() => stored as T | null,
      set: async (_k: string, v: unknown) => {
        stored = v as InviteAuditEntry[]
      },
    }
    await recordInviteAudit(
      { inviterUserId: 'user_new', inviteeEmail: 'new@example.com', roleGranted: 'exec' },
      { store, now: () => new Date('2026-08-20T12:00:00.000Z') },
    )
    const trail = await listInviteAudit(store)
    expect(trail).toHaveLength(AUDIT_MAX)
    expect(trail[0].inviteeEmail).toBe('new@example.com')
    expect(trail.some((e) => e.inviteeEmail === `old${AUDIT_MAX - 1}@example.com`)).toBe(false)
  })
})
