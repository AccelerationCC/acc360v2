/**
 * Role predicates with NO imports — safe in any environment.
 *
 * WHY A SEPARATE MODULE. These rules are needed on both sides: the server
 * guards (lib/adminGuard.ts, lib/execGuard.ts) and the client surfaces
 * (lib/hooks/useAdmin.ts). Those guards import from '@clerk/nextjs/server', so
 * a client hook importing the predicate from there would drag server-only code
 * into the browser bundle. Keeping the rules import-free is what lets one
 * definition serve both. (client-newsroom does the same thing with
 * src/lib/auth-public.ts, for the same reason.)
 *
 * WHY IT EXISTS AT ALL. The admin rule was written out three times, and they
 * did not agree:
 *
 *   requireAdmin (adminGuard.ts)     superexec | admin | king
 *   useAdmin (hooks/useAdmin.ts)     superexec
 *   companies/new/page.tsx           superexec
 *
 * So a king or admin was allowed by the API but saw no "Add Company" button
 * and was redirected away from /companies/new — permitted to do the thing,
 * with no way to ask for it. Both this repo and client-newsroom document that
 * king clears every gate, so the two narrow copies were defects rather than
 * policy. One definition, three callers.
 */

/**
 * Roles carrying the company-management privilege.
 *
 * "exec" is deliberately absent: company management is the single privilege
 * that separates "superexec" from "exec", and widening this to admit "exec"
 * erases the distinction. That was attempted once and reverted — see the role
 * model at the top of lib/adminGuard.ts.
 *
 * "admin" is a TEMPORARY BRIDGE for accounts not yet retagged to "superexec"
 * in the Clerk dashboard; removing it before retagging locks those accounts
 * out rather than renaming them.
 */
export const ADMIN_TIER_ROLES = ['superexec', 'admin', 'king'] as const

/** Whether a role claim carries the company-management privilege. */
export function hasAdminTier(role: unknown): boolean {
  return typeof role === 'string' && (ADMIN_TIER_ROLES as readonly string[]).includes(role)
}
