import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/api/newsletter/generate',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // The root itself. Under basePath, Next prefixes these matchers, so the
    // pattern above becomes '/360/(...)' and requires a segment after /360 —
    // leaving the basePath root unmatched. Middleware then never runs there,
    // and any auth() in the layout throws "Clerk can't detect usage of
    // clerkMiddleware()", a 500 on the app's own home page. Clerk's
    // recommended matcher carries this entry for the same reason.
    '/',
    '/(api|trpc)(.*)',
  ],
}
