/**
 * Self-service exec invites — the logic behind POST /api/invitations.
 *
 * Mirrors client-newsroom/src/lib/hr-invites.ts deliberately: same extracted-
 * plain-function shape, same hardcoded-role security model, same best-effort
 * audit. If you change one, read the other.
 *
 * THE ROLE IS NOT AN INPUT. See EXEC_INVITE_ROLE.
 */

/**
 * The only role this endpoint can ever grant.
 *
 * Hardcoded, never a request field. The gate (requireExec) admits both "exec"
 * and "admin", so if the role travelled in the body an exec could POST
 * {"role":"admin"} and mint a second admin — granting themselves, by proxy,
 * the company-management privilege that is the ONLY thing separating the two
 * roles. Creating another admin stays a manual Clerk-dashboard action.
 *
 * Pinned by lib/execInvites.test.ts, which posts every wrong role it can think
 * of and asserts the payload built for Clerk still says "exec".
 */
export const EXEC_INVITE_ROLE = 'exec' as const

/** Exactly the Clerk `createInvitation` params this module builds. */
export interface InvitationParams {
  emailAddress: string
  publicMetadata: { role: typeof EXEC_INVITE_ROLE }
  notify: boolean
}

/**
 * The slice of Clerk's invitations API used here.
 *
 * Single-create only, no bulk: the installed @clerk/backend (1.14.1, via
 * @clerk/nextjs 5.7.6) exposes getInvitationList, createInvitation and
 * revokeInvitation — createInvitationBulk landed in a later major and is NOT
 * available here, which is why this loops where the newsroom batches.
 * Verified against the installed typings and Clerk's current published docs
 * for createInvitation (2026-08-20): { emailAddress, publicMetadata, notify,
 * ignoreExisting?, redirectUrl?, expiresInDays?, templateSlug? }.
 */
export interface InvitationsClient {
  createInvitation(params: InvitationParams): Promise<unknown>
}

export interface InviteResult {
  email: string
  status: 'sent' | 'failed'
  error?: string
}

export interface CreateExecInvitesDeps {
  invitations: InvitationsClient
  /** Clerk id of the caller, from the session — never from the request body. */
  inviterUserId: string
  recordAudit: (entry: {
    inviterUserId: string
    inviteeEmail: string
    roleGranted: string
  }) => Promise<void>
}

export type ParsedEmails = { ok: true; emails: string[] } | { ok: false; error: string }

/**
 * Conservative address check — enough to keep malformed input out of Clerk,
 * not an attempt at RFC 5322. This app had no email validator; the newsroom's
 * equivalent lives in its newsletter-email module.
 */
export function isValidInviteEmail(email: string): boolean {
  if (email.length > 254) return false
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)
}

/**
 * Step 1 of the three — input validation, before auth or the role check.
 * Normalises (trim + lowercase + dedupe) and enforces the batch ceiling.
 *
 * A `role` in the body is ignored rather than rejected: rejecting would imply
 * the field means something.
 */
export function parseInviteEmails(input: unknown): ParsedEmails {
  const raw = (input as { emails?: unknown } | null)?.emails
  if (!Array.isArray(raw)) return { ok: false, error: 'emails must be an array' }
  // Array.from, not [...new Set()] — this app's tsconfig targets es5, where a
  // Set spread needs --downlevelIteration. Same dedupe, no compiler flag.
  const emails = Array.from(
    new Set(
      raw
        .filter((e): e is string => typeof e === 'string')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
  if (emails.length === 0) return { ok: false, error: 'at least one email is required' }
  if (emails.length > 25) return { ok: false, error: 'at most 25 invitations per batch' }
  return { ok: true, emails }
}

/** The params sent to Clerk for one address. Role comes from the constant. */
export function buildInvitationParams(email: string): InvitationParams {
  return {
    emailAddress: email,
    // Clerk copies an invitation's publicMetadata into the user's
    // publicMetadata on signup, so the invited person arrives already holding
    // the exec role instead of being locked out on arrival.
    publicMetadata: { role: EXEC_INVITE_ROLE },
    notify: true,
  }
}

/**
 * Creates the invitations and writes one audit row per address Clerk accepted.
 *
 * Audit writes are best-effort: the invite has already been sent by the time
 * we record it, so a failed write must not turn a delivered invitation into an
 * error the caller retries.
 */
export async function createExecInvitations(
  emails: string[],
  deps: CreateExecInvitesDeps,
): Promise<{ sent: number; failed: number; results: InviteResult[] }> {
  const results: InviteResult[] = []

  for (const email of emails) {
    if (!isValidInviteEmail(email)) {
      results.push({ email, status: 'failed', error: 'not a valid email address' })
      continue
    }
    try {
      await deps.invitations.createInvitation(buildInvitationParams(email))
      results.push({ email, status: 'sent' })
      try {
        await deps.recordAudit({
          inviterUserId: deps.inviterUserId,
          inviteeEmail: email,
          roleGranted: EXEC_INVITE_ROLE,
        })
      } catch (err) {
        console.error('[execInvites] audit write failed for', email, err)
      }
    } catch (err) {
      results.push({ email, status: 'failed', error: clerkErrorMessage(err) })
    }
  }

  const sent = results.filter((r) => r.status === 'sent').length
  return { sent, failed: results.length - sent, results }
}

/** Clerk API errors carry a per-error list; surface the human message. */
export function clerkErrorMessage(err: unknown): string {
  const errors = (err as { errors?: Array<{ message?: string; longMessage?: string }> })?.errors
  const first = errors?.[0]
  if (first?.longMessage || first?.message) return first.longMessage ?? first.message ?? 'failed'
  return err instanceof Error ? err.message : 'failed'
}
