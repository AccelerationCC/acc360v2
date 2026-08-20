import { kv } from '@vercel/kv'

/**
 * Invite audit trail — one append-only entry per invitation actually sent.
 *
 * Cheapest store this app already has: Vercel KV, the same place newsletters
 * live (lib/kv.ts). No new infrastructure, no schema. The newsroom writes its
 * equivalent to a Prisma table because that is what IT already has — same four
 * facts either side.
 *
 * A capped list rather than an unbounded one: invites are rare, and an audit
 * trail that grows forever in a KV value eventually stops being readable.
 * AUDIT_MAX keeps the newest entries and drops the oldest.
 */

const AUDIT_KEY = 'invite:audit'

/** Newest-first; entries beyond this are dropped on write. */
export const AUDIT_MAX = 500

export interface InviteAuditEntry {
  inviterUserId: string
  inviteeEmail: string
  roleGranted: string
  /** ISO 8601, UTC. */
  createdAt: string
}

/** The slice of KV this module needs, so tests can pass a fake. */
export interface AuditKv {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<unknown>
}

/**
 * Appends one entry. Throws on failure — the caller decides whether that is
 * fatal, and for invites it deliberately is not (see createExecInvitations).
 *
 * `now` is injectable so a test can assert the timestamp instead of having to
 * match whatever the clock said.
 */
export async function recordInviteAudit(
  entry: Omit<InviteAuditEntry, 'createdAt'>,
  opts: { store?: AuditKv; now?: () => Date } = {},
): Promise<void> {
  const store = opts.store ?? (kv as unknown as AuditKv)
  const createdAt = (opts.now ? opts.now() : new Date()).toISOString()
  const existing = (await store.get<InviteAuditEntry[]>(AUDIT_KEY)) ?? []
  const updated = [{ ...entry, createdAt }, ...existing].slice(0, AUDIT_MAX)
  await store.set(AUDIT_KEY, updated)
}

/** Newest-first read, for whoever wants to look at the trail later. */
export async function listInviteAudit(store?: AuditKv): Promise<InviteAuditEntry[]> {
  const s = store ?? (kv as unknown as AuditKv)
  return (await s.get<InviteAuditEntry[]>(AUDIT_KEY)) ?? []
}
