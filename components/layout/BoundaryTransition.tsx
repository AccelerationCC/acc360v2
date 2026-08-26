'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * DUPLICATE of client-newsroom/src/components/BoundaryTransition.tsx — that
 * file is the source of truth; change both in the same commit. Same
 * separate-repos discipline as the wordmark and lib/capabilities.ts.
 *
 * Used for leaving /360 back to the newsroom. Does not gate on the animation:
 * the destination is warmed the moment the link is clicked, and navigation
 * fires at max(minimum display, fetch settled), hard-capped.
 * prefers-reduced-motion drops the sweep and collapses the delay.
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
      {leaving && (
        <div
          role="status"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background px-6"
        >
          <p className="max-w-md text-center font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/60">
            {message}
          </p>
          <div className="h-px w-56 overflow-hidden bg-foreground/10" aria-hidden="true">
            <div
              className="boundary-fill h-full w-full origin-left bg-acc-blue"
              style={{ animationDuration: `${durationMs}ms` }}
            />
          </div>
        </div>
      )}
    </>
  )
}
