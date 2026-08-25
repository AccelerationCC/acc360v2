import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { NextRequest } from 'next/server'

const authMock = vi.fn()
const currentUserMock = vi.fn()
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock, currentUser: currentUserMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('../lib/airtable', () => ({
  getAllCompanies: vi.fn(async () => []),
  getCompany: vi.fn(async () => ({})),
  getAirtableSchema: vi.fn(async () => ({})),
  airtableError: () => ({ type: 'unknown', message: 'stub', status: 500 }),
}))

function signedInAs(role: string | null, userId = 'user_abc') {
  authMock.mockResolvedValue({ userId })
  currentUserMock.mockResolvedValue({
    id: userId,
    publicMetadata: role === null ? {} : { role },
  })
}

afterEach(() => vi.clearAllMocks())

// Roles that may view ACC360. `admin` is the deprecation bridge and must keep
// working until Clerk users are retagged to `superexec`.
const ALLOWED = ['exec', 'superexec', 'king', 'admin']
// Everyone else. `hr` is the case that matters: before this gate existed, an
// hr account could browse the entire dashboard and read real company data.
const DENIED = ['hr', 'viewer', 'Exec', 'EXEC', 'Admin', null]

describe('hasExecTier', () => {
  it('admits exactly the exec tier', async () => {
    const { hasExecTier } = await import('./execGuard')
    for (const r of ALLOWED) expect(hasExecTier(r), `${r} should pass`).toBe(true)
    for (const r of DENIED) expect(hasExecTier(r), `${String(r)} should fail`).toBe(false)
    expect(hasExecTier(undefined)).toBe(false)
  })
})

describe('ensureExecPage — the page-level gate', () => {
  it('lets every exec-tier role through without redirecting', async () => {
    const { ensureExecPage } = await import('./execGuard')
    for (const role of ALLOWED) {
      signedInAs(role)
      await expect(ensureExecPage(), `${role} must pass`).resolves.toBeUndefined()
    }
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('redirects an hr account to /no-access', async () => {
    const { ensureExecPage } = await import('./execGuard')
    signedInAs('hr')
    await expect(ensureExecPage()).rejects.toThrow('REDIRECT:/no-access')
  })

  it('redirects an account with NO role to /no-access', async () => {
    const { ensureExecPage } = await import('./execGuard')
    signedInAs(null)
    await expect(ensureExecPage()).rejects.toThrow('REDIRECT:/no-access')
  })

  it('redirects unrecognised and case-variant roles', async () => {
    const { ensureExecPage } = await import('./execGuard')
    for (const role of ['viewer', 'Exec', 'EXEC']) {
      signedInAs(role)
      await expect(ensureExecPage(), `${role} must be denied`).rejects.toThrow('REDIRECT:/no-access')
    }
  })

  it('sends a signed-out caller to /sign-in, not /no-access', async () => {
    const { ensureExecPage } = await import('./execGuard')
    authMock.mockResolvedValue({ userId: null })
    await expect(ensureExecPage()).rejects.toThrow('REDIRECT:/sign-in')
  })
})

// The API half. Page gating alone would leave these open to a direct fetch.
describe('read endpoints reject non-exec sessions', () => {
  it('GET /api/companies 403s an hr account and 200s an exec', async () => {
    const { GET } = await import('../app/api/companies/route')
    signedInAs('hr')
    expect((await GET()).status).toBe(403)
    signedInAs('exec')
    expect((await GET()).status).toBe(200)
  })

  it('GET /api/airtable/schema 403s an hr account', async () => {
    const { GET } = await import('../app/api/airtable/schema/route')
    signedInAs('hr')
    expect((await GET()).status).toBe(403)
  })

  it('GET /api/newsletter 403s an hr account', async () => {
    const { GET } = await import('../app/api/newsletter/route')
    signedInAs('hr')
    const res = await GET(new NextRequest('http://localhost/api/newsletter'))
    expect(res.status).toBe(403)
  })

  it('POST /api/chat 403s an hr account', async () => {
    const { POST } = await import('../app/api/chat/route')
    signedInAs('hr')
    const res = await POST(
      new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
      }),
    )
    expect(res.status).toBe(403)
  })

  it('an account with no role is refused too', async () => {
    const { GET } = await import('../app/api/companies/route')
    signedInAs(null)
    expect((await GET()).status).toBe(403)
  })

  it('the admin bridge still reaches the data', async () => {
    const { GET } = await import('../app/api/companies/route')
    signedInAs('admin')
    expect((await GET()).status).toBe(200)
  })
})

// A structural pin. ensureExecPage is only worth anything if the dashboard
// layout actually calls it, and nothing else in this suite would notice if that
// line were deleted — the page gate would silently disappear while every other
// test stayed green. Verified by mutation: removing the call fails this.
describe('the dashboard layout actually invokes the gate', () => {
  const layout = fileURLToPath(new URL('../app/(dashboard)/layout.tsx', import.meta.url))

  it('awaits ensureExecPage before rendering', async () => {
    const text = await readFile(layout, 'utf-8')
    expect(text).toMatch(/await\s+ensureExecPage\(\)/)
    expect(text).toContain("from '@/lib/execGuard'")
    // It must be an async component, or the await is a syntax error rather
    // than a gate.
    expect(text).toMatch(/export default async function DashboardLayout/)
  })

  it('every read endpoint calls requireExec', async () => {
    const files = [
      '../app/api/companies/route.ts',
      '../app/api/companies/[id]/route.ts',
      '../app/api/chat/route.ts',
      '../app/api/newsletter/route.ts',
      '../app/api/airtable/schema/route.ts',
    ]
    for (const f of files) {
      const text = await readFile(fileURLToPath(new URL(f, import.meta.url)), 'utf-8')
      expect(text, `${f} must call requireExec`).toMatch(/const guard = await requireExec\(\)/)
    }
  })
})
