import { useUser } from '@clerk/nextjs'

/**
 * Returns whether the signed-in user has the superexec role.
 * Role is read from Clerk publicMetadata: { role: "superexec" }.
 * To grant superexec: set publicMetadata.role = "superexec" on the user in Clerk Dashboard.
 *
 * isLoaded: false while Clerk is still hydrating — callers should render nothing
 * (not a fallback) until isLoaded is true so write controls never flash briefly.
 */
export function useAdmin(): { isAdmin: boolean; isLoaded: boolean } {
  const { user, isLoaded } = useUser()
  return {
    isAdmin: isLoaded && user?.publicMetadata?.role === 'superexec',
    isLoaded,
  }
}
