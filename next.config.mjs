/** @type {import('next').NextConfig} */

// Mounted under /360 so client-newsroom can front this app (see the proxy route
// in that repo). basePath makes Next emit and expect /360-prefixed URLs for
// pages, /360/_next/* assets and API routes. Env-driven so a standalone
// `npm run dev` (variable unset) still serves from the root unchanged.
const basePath = process.env.ACC360_BASE_PATH ?? ''

const nextConfig = {
  ...(basePath ? { basePath } : {}),

  // Safety net for anyone landing on the bare origin once basePath is live:
  // without this, "/" is outside the mounted app and 404s.
  //
  // `basePath: false` on the rule is load-bearing. Next prefixes a redirect's
  // `source` with basePath by default, so a plain `source: '/'` would compile
  // to `/360/` — redirecting the app's own home page to itself and leaving the
  // true root still 404ing. Opting out makes the source the literal origin root.
  //
  // 307, not 308: a permanent redirect is cached by browsers and painful to
  // walk back if the mount point ever changes.
  async redirects() {
    if (!basePath) return []
    return [{ source: '/', destination: basePath, permanent: false, basePath: false }]
  },

  // Allow the airtable package to run in server components without bundling
  // issues. Top-level since Next 15 (was experimental.serverComponentsExternalPackages).
  serverExternalPackages: ['airtable'],
}

export default nextConfig
