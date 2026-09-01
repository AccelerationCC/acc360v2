/** @type {import('next').NextConfig} */

// Mounted under /360 so client-newsroom can front this app (see the proxy route
// in that repo). basePath makes Next emit and expect /360-prefixed URLs for
// pages, /360/_next/* assets and API routes. Env-driven so a standalone
// `npm run dev` (variable unset) still serves from the root unchanged.
const basePath = process.env.ACC360_BASE_PATH ?? ''

// IF YOU CHANGE ACC360_BASE_PATH, CHANGE vercel.json BY HAND. The cron entry
// there hardcodes the literal string `/360/api/newsletter/generate`, because
// vercel.json is static JSON — it cannot interpolate an environment variable
// and it cannot hold a comment saying so, which is why this note lives here
// instead, next to the thing that would move.
//
// The two are only equal by convention, and nothing checks the equality. That
// asymmetry has already cost a day: Vercel Cron requests the path exactly as
// written, and while the path was the un-prefixed `/api/newsletter/generate`
// it landed outside the mounted app and returned an instant 404 every morning
// with no error anywhere — a cron that "ran" and did nothing.

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
