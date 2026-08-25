import { UserButton } from '@clerk/nextjs'
import { EntranceGlows, EntranceWordmark } from '@/components/ui/entrance'

/**
 * Where a signed-in user WITHOUT a 360 role lands (see ensureExecPage).
 *
 * Ported from client-newsroom's hr.no-access.tsx — same layout, same tone,
 * same tokens. Deliberately OUTSIDE the (dashboard) route group, so it is not
 * gated by the layout that sends people here; it must render for exactly the
 * accounts every dashboard page turns away, and it exposes nothing but the
 * explanation. The UserButton lets someone signed into the wrong account
 * switch without hunting for a sign-out.
 */
export const metadata = { title: 'Restricted — ACC360' }

export default function NoAccess() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      <EntranceGlows />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[520px] flex-col items-center justify-between px-6 py-6">
        <header className="flex w-full items-center justify-between pt-2">
          {/* Plain anchor, not next/link: "/" is the newsroom at the proxy
              root, outside this app's basePath. A client-side transition would
              try to resolve it inside ACC360 and 404. */}
          <EntranceWordmark href="/" />
          <UserButton />
        </header>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
          <span className="inline-block rounded-full bg-acc-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-acc-blue">
            ACC360 · Restricted
          </span>
          <h1 className="font-editorial text-4xl leading-tight tracking-tight sm:text-5xl">
            Oops, looks like you don&apos;t have access to this area
          </h1>
          <p className="mx-auto max-w-[360px] text-[13px] leading-relaxed text-foreground/55">
            You&apos;re signed in, but your account doesn&apos;t have 360 access. If you should have
            it, contact an administrator — or switch accounts with the avatar above.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-acc-blue px-5 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            Back to Client Newsroom
          </a>
        </div>

        <footer className="pb-2 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/25">
          ACC360 · ACC
        </footer>
      </div>
    </div>
  )
}
