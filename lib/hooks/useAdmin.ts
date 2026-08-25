import { useUser } from '@clerk/nextjs'
import { hasAdminTier } from '@/lib/roles'

/**
 * Returns whether the signed-in user carries the company-management privilege.
 * Role is read from Clerk publicMetadata: { role: … }.
 *
 * Uses the SAME predicate as requireAdmin (lib/roles.ts). It previously tested
 * `role === 'superexec'` alone, so a king or admin was permitted by the API but
 * saw none of the write controls this hook gates.
 *
 * isLoaded: false while Clerk is still hydrating — callers should render nothing
 * (not a fallback) until isLoaded is true so write controls never flash briefly.
 */
export function useAdmin(): { isAdmin: boolean; isLoaded: boolean } {
  const { user, isLoaded } = useUser()
  return {
    isAdmin: isLoaded && hasAdminTier(user?.publicMetadata?.role),
    isLoaded,
  }
}
