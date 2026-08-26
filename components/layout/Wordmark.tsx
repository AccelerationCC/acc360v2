'use client'

import Link from 'next/link'

/**
 * THE WORDMARK — duplicate of client-newsroom/src/components/Wordmark.tsx,
 * which is the source of truth. Same discipline as lib/capabilities.ts:
 * separate repos, separate Vercel projects, no workspace — change both in the
 * same commit or the two apps stop matching.
 *
 * One local difference, deliberate: next/link instead of <a>, because a bare
 * <a href="/"> escapes the /360 basePath and lands on the newsroom. The mark
 * inside ACC360 goes to ACC360's own home.
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
      aria-label="Acceleration News — home"
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
