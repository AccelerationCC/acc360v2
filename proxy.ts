import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Next 16 renamed the `middleware` file convention to `proxy`. This is not a
// pure rename: `proxy` runs on the NODE.JS runtime, always — the `runtime`
// segment option is rejected in a proxy file — whereas `middleware` defaulted
// to the edge runtime. Nothing here needs edge (no geolocation, no edge-only
// API), and Clerk's own session verification is happier with full Node crypto,
// so the move is safe. What it costs is where the gate executes: a regional
// Node function rather than the nearest CDN PoP. See the branch notes.
//
// Kept as a DEFAULT export rather than a named `proxy` function, because there
// is no function of ours to name — clerkMiddleware() returns the handler. The
// convention accepts either.

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/api/newsletter/generate',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    // Awaited deliberately: auth.protect() has been async since @clerk/nextjs
    // v6, and an un-awaited call is the documented cause of it failing OPEN in
    // a Next 16 proxy — the redirect never resolves and protected content is
    // served to a signed-out visitor (clerk/javascript#8302).
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // The root itself. Under basePath, Next prefixes these matchers, so the
    // pattern above becomes '/360/(...)' and requires a segment after /360 —
    // leaving the basePath root unmatched. The proxy then never runs there,
    // and any auth() in the layout throws "Clerk can't detect usage of
    // clerkMiddleware()", a 500 on the app's own home page. Clerk's
    // recommended matcher carries this entry for the same reason.
    '/',
    '/(api|trpc)(.*)',
  ],
}
