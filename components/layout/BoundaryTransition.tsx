'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * DUPLICATE of client-newsroom/src/components/BoundaryTransition.tsx — that
 * file is the source of truth; change both in the same commit. Same
 * separate-repos discipline as the wordmark and lib/capabilities.ts.
 *
 * Used for leaving /360 back to the newsroom. Does not gate on the animation:
 * the destination is warmed the moment the link is clicked, and navigation
 * fires at max(minimum display, fetch settled), hard-capped.
 * prefers-reduced-motion drops the sweep and collapses the delay.
 *
 * PORTALLED TO document.body, and not optional — see the newsroom copy for the
 * full account. Two separate ancestors would otherwise capture it:
 *
 *   in the newsroom  tier 1 carries backdrop-blur-xl, and a backdrop-filter
 *                    establishes a containing block for fixed descendants, so
 *                    `fixed inset-0` resolved to the nav's own box.
 *   here             the <aside> is `fixed z-30`, which opens a STACKING
 *                    CONTEXT — z-[100] cannot climb out of it, so the overlay
 *                    would paint at the sidebar's level rather than above the
 *                    whole app.
 *
 * The portal removes both at once. Do not move it back into the tree.
 */
export function BoundaryTransition({
  href,
  message,
  durationMs = 1800,
  children,
  className,
  title,
}: {
  href: string
  message: string
  durationMs?: number
  children: ReactNode
  className?: string
  title?: string
}) {
  const [leaving, setLeaving] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!leaving || started.current) return
    started.current = true

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const minDisplay = reduced ? 150 : durationMs
    const cap = reduced ? 400 : durationMs + 600

    const go = () => window.location.assign(href)
    const start = Date.now()
    const warm = fetch(href, { credentials: 'include' }).catch(() => undefined)
    const minWait = new Promise((r) => setTimeout(r, minDisplay))
    const capWait = new Promise((r) => setTimeout(r, cap))

    void Promise.race([Promise.all([warm, minWait]), capWait]).then(() => {
      const elapsed = Date.now() - start
      if (elapsed >= minDisplay) go()
      else setTimeout(go, minDisplay - elapsed)
    })
  }, [leaving, href, durationMs])

  // Nothing scrolls behind the overlay. Restored on unmount so a cancelled
  // navigation cannot leave the page permanently unscrollable.
  useEffect(() => {
    if (!leaving) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [leaving])

  return (
    <>
      <a
        href={href}
        className={className}
        title={title}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
          e.preventDefault()
          setLeaving(true)
        }}
      >
        {children}
      </a>
      {leaving &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="status"
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-background px-6"
          >
            {/* Tracking eases off below sm so the sentence does not overflow a
                narrow viewport before it can wrap; text-balance keeps the two
                lines even instead of one long line and an orphan. */}
            <p className="max-w-md text-balance text-center font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/60 sm:max-w-2xl sm:tracking-[0.3em]">
              {message}
            </p>
            {/* Wider than the original 224px: full-viewport now, and at 1440
                the old hairline read as lost rather than deliberate. */}
            <div
              className="h-px w-64 overflow-hidden bg-foreground/10 sm:w-80"
              aria-hidden="true"
            >
              <div
                className="boundary-fill h-full w-full origin-left bg-acc-blue"
                style={{ animationDuration: `${durationMs}ms` }}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
