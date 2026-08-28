'use client'

import Link from 'next/link'

/**
 * THE WORDMARK — duplicate of client-newsroom/src/components/Wordmark.tsx,
 * which is the source of truth. Same discipline as lib/capabilities.ts:
 * separate repos, separate Vercel projects, no workspace — change both in the
 * same commit or the two apps stop matching.
 *
 * TWO local differences, both deliberate, both about the same basePath:
 *
 * 1. next/link instead of <a>, because a bare <a href="/"> escapes the /360
 *    basePath and lands on the newsroom. The mark inside ACC360 goes to
 *    ACC360's own home.
 * 2. The aria-label therefore says ACC360, NOT "Acceleration News — home" as
 *    the newsroom's copy does. The label has to name the place the link
 *    actually reaches. With next/link the href "/" resolves to /360, so the
 *    newsroom's wording would announce the newsroom and then land on the
 *    ACC360 dashboard — the mark reads "Acceleration News" visually either
 *    way, and only the label makes the destination unambiguous.
 *
 * Note the sidebar holds TWO links written href="/" that go to different
 * places: this one (next/link -> /360) and "Back to the newsroom"
 * (bare <a> -> /). That is correct. Do not make them consistent.
 *
 * `badgeOnly` renders just the bronze block with the dot — the collapsed
 * sidebar is 64px wide and the full mark cannot fit.
 */
export function Wordmark({
  size = 15,
  badgeOnly = false,
  className,
}: {
  size?: number
  badgeOnly?: boolean
  className?: string
}) {
  return (
    <Link
      href="/"
      aria-label="ACC360 — home"
      className={className ? `wordmark ${className}` : 'wordmark'}
      style={{ fontSize: size }}
    >
      {!badgeOnly && <span className="wordmark-name">Acceleration</span>}
      <span className="wordmark-badge">
        <span className="wordmark-dot" aria-hidden="true" />
        News
      </span>
    </Link>
  )
}
