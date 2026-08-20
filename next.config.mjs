/** @type {import('next').NextConfig} */

// Mounted under /360 so client-newsroom's dev server can proxy a single
// prefix to this process (see vite.config.ts on that repo's combine-acc360
// branch). basePath makes Next emit and expect /360-prefixed URLs for pages,
// /360/_next/* assets and its API routes, which is what lets the proxy be a
// plain forward with no path rewriting. Env-driven so a standalone
// `npm run dev` (no prefix) still works: unset ACC360_BASE_PATH for that.
const basePath = process.env.ACC360_BASE_PATH ?? ''

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  experimental: {
    // Allow the airtable package to run in server components without bundling issues
    serverComponentsExternalPackages: ['airtable'],
  },
}

export default nextConfig
