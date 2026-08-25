'use client'

import { Fragment, useSyncExternalStore, type ReactNode } from 'react'

// The entrance pages' shared vocabulary, ported from client-newsroom's
// src/components/entrance-ui.tsx so ACC360's door dresses the same way as the
// newsroom's: eyebrow pill, Instrument Serif italic display, grain film,
// world-clock strip. Same markup and same tokens — the tokens were translated
// into this app's globals.css during the reskin, so these render identically.
//
// Two deliberate omissions from the newsroom's version: ThemeToggle (this app
// is light-only for now) and SignalTrace (it is wired to the newsroom's own
// data).

/** Pill above the headline. Smallest text on the page, so it stays
 * text-foreground for contrast; only the dot is bronze. */
export function EntranceEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 rounded-full border border-acc-blue/15 bg-background/60 px-3 py-1 backdrop-blur-md">
      <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.28em] text-foreground">
        <span className="h-1 w-1 rounded-full bg-acc-blue" />
        {children}
      </span>
    </div>
  )
}

/** The display headline — Instrument Serif italic. */
export function EntranceHeadline({ children }: { children: ReactNode }) {
  return (
    <h1
      className="mb-5 text-[3.25rem] leading-[0.9] tracking-tight text-foreground sm:text-6xl"
      style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}
    >
      {children}
    </h1>
  )
}

/** Subtle SVG-noise film over the backdrop, under the content. */
export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
      }}
    />
  )
}

/** The two large blurred glows behind the content. */
export function EntranceGlows() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -right-1/4 -top-1/4 h-[80%] w-[80%] rounded-full bg-acc-blue/10 blur-[140px]" />
      <div className="absolute -bottom-1/4 -left-1/4 h-[80%] w-[80%] rounded-full bg-muted-ink/10 blur-[140px]" />
    </div>
  )
}

const CLOCK_ZONES: { label: string; timeZone: string }[] = [
  { label: 'NYC', timeZone: 'America/New_York' },
  { label: 'LDN', timeZone: 'Europe/London' },
  { label: 'TYO', timeZone: 'Asia/Tokyo' },
]

// The clock as an external store rather than state driven by an effect. The
// effect version called setNow() synchronously on mount to fill in the first
// time, which is what react-hooks/set-state-in-effect objects to: it commits a
// render, then immediately schedules another.
//
// One interval shared by every subscriber, and a snapshot that changes ONLY on
// tick — getSnapshot has to return a stable reference between ticks, since
// handing back a fresh Date on every call would re-render forever.
let clockSnapshot: Date | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
const clockListeners = new Set<() => void>()

function subscribeClock(onStoreChange: () => void): () => void {
  // Refreshed on subscribe, so a component mounting between ticks shows the
  // current time instead of whatever the last tick left behind.
  clockSnapshot = new Date()
  clockListeners.add(onStoreChange)
  clockTimer ??= setInterval(() => {
    clockSnapshot = new Date()
    for (const listener of clockListeners) listener()
  }, 30_000)

  return () => {
    clockListeners.delete(onStoreChange)
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer)
      clockTimer = null
    }
  }
}

const getClockSnapshot = () => clockSnapshot
// The server has no clock. null keeps SSR markup and the first client paint in
// agreement — the same thing the old `useState<Date | null>(null)` achieved.
const getClockServerSnapshot = () => null

function useClock() {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, getClockServerSnapshot)
}

/**
 * The world-clock strip — real data, and the only figures allowed on an
 * unauthenticated page (anything else would be invented). Rendered null until
 * mounted so server and client markup agree.
 */
export function WorldClockStrip() {
  const now = useClock()
  return (
    <div className="flex items-center justify-between border-t border-acc-gold/10 px-1 pt-4 font-mono text-[10px] uppercase tracking-widest text-foreground/70">
      {CLOCK_ZONES.map((z, i) => (
        <Fragment key={z.label}>
          <div className="flex items-center gap-2">
            <span>{z.label}</span>
            <span className="text-acc-gold">
              {now
                ? now.toLocaleTimeString('en-US', {
                    timeZone: z.timeZone,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })
                : '--:--'}
            </span>
          </div>
          {i < CLOCK_ZONES.length - 1 && <div className="h-3 w-px bg-acc-gold/10" />}
        </Fragment>
      ))}
    </div>
  )
}

/** The ACC wordmark used in both entrance headers. */
export function EntranceWordmark({ href }: { href?: string }) {
  const inner = (
    <>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-acc-blue" />
      ACC
    </>
  )
  const cls =
    'flex items-center gap-2 font-sans text-sm font-bold tracking-[0.35em] text-foreground'
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <span className={cls}>{inner}</span>
  )
}
