/**
 * basePath-aware API fetch.
 *
 * WHY THIS EXISTS. This app runs under `basePath: "/360"` when it is mounted
 * behind client-newsroom (see next.config.mjs). Next's basePath prefixes
 * next/link hrefs, router navigation and asset URLs — but it does NOT touch
 * hand-written fetch() calls. So `fetch('/api/companies')` from a page served
 * at /360/companies resolves against the ORIGIN, hitting /api/companies on
 * whatever host is fronting the app. Mounted behind the newsroom that is the
 * newsroom's origin, which has no such route, and the page shows
 * "Failed to fetch".
 *
 * NEXT_PUBLIC_ on purpose: this runs in the browser, so the value has to be
 * inlined at build time. The server-side ACC360_BASE_PATH that next.config.mjs
 * reads is invisible to client code, which is exactly why this bug survived —
 * the base path was configured correctly and the client still could not see it.
 *
 * Unset means empty, so a standalone deploy at the root keeps working with no
 * configuration.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefixes an app-absolute API path with the base path.
 *
 * Only rewrites paths starting with "/" — an absolute URL is returned
 * unchanged, so a caller reaching a third-party API is unaffected. Already-
 * prefixed paths are left alone, so double-prefixing is impossible if a call
 * site is converted twice.
 */
export function apiUrl(path: string): string {
  if (!BASE_PATH) return path;
  if (!path.startsWith("/")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}

/**
 * Drop-in replacement for fetch() against this app's own API.
 *
 * Every client-side call to /api/* must go through here. A raw
 * `fetch('/api/...')` is a bug under basePath, and lib/apiPath.test.ts fails
 * the build if a new one appears.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
