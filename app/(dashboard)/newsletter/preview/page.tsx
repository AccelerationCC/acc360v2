'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Lock } from 'lucide-react'
import { apiFetch } from '@/lib/apiPath'
import { SLOT_IDS, REGENERABLE_SLOTS, type NewsletterEdition, type SlotId, type RegenerableSlotId } from '@/types/newsletterTemplate'

/**
 * /newsletter/preview — the exact HTML, and one regenerate control per slot.
 *
 * THE IFRAME IS THE POINT. The newsletter renders in a sandboxed iframe fed by
 * srcDoc with the string the server produced, so what is on screen IS the
 * artifact — not this page's Tailwind approximating it. Rendering the template
 * inline would inherit the dashboard's stylesheet and quietly diverge.
 *
 * basePath: every call goes through apiFetch, which prefixes NEXT_PUBLIC_BASE_PATH.
 * Calling the platform fetch directly on an app-absolute API path would resolve
 * against the newsroom's origin when this app is mounted behind it — see
 * lib/apiPath.ts, whose test scans for exactly that mistake. (This sentence
 * avoids spelling the pattern out: that guard matches source text, so a comment
 * describing the bug would register as the bug.)
 */

const SLOT_LABELS: Record<SlotId, string> = {
  masthead: 'Masthead',
  editionLine: 'Edition line',
  hero: 'Hero',
  observances: 'Observances',
  brief: 'Hot List brief',
  footer: 'Footer',
}

const isRegenerable = (id: SlotId): id is RegenerableSlotId =>
  (REGENERABLE_SLOTS as readonly string[]).includes(id)

export default function NewsletterPreviewPage() {
  const [edition, setEdition] = useState<NewsletterEdition | null>(null)
  const [html, setHtml] = useState<string>('')
  const [busy, setBusy] = useState<SlotId | null>(null)
  const [error, setError] = useState<string | null>(null)

  // No synchronous setState in the effect body (react-hooks/set-state-in-effect),
  // and a cancel flag so an unmount mid-request does not set state on a dead
  // component. Both were real: the first version called setError(null) before
  // its first await and had no cleanup at all.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/api/newsletter/preview')
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { edition: NewsletterEdition; html: string }
        if (cancelled) return
        setEdition(data.edition)
        setHtml(data.html)
        setError(null)
      } catch {
        if (!cancelled) setError('Could not load the preview.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const regenerate = useCallback(
    async (slot: RegenerableSlotId) => {
      if (!edition) return
      setBusy(slot)
      setError(null)
      try {
        const res = await apiFetch('/api/newsletter/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ edition, slot }),
        })
        if (!res.ok) throw new Error(`${res.status}`)
        const data = (await res.json()) as { edition: NewsletterEdition; html: string }
        setEdition(data.edition)
        setHtml(data.html)
      } catch {
        setError(`Could not regenerate the ${SLOT_LABELS[slot].toLowerCase()}.`)
      } finally {
        setBusy(null)
      }
    },
    [edition],
  )

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="font-editorial text-3xl text-foreground">Newsletter preview</h1>
        <p className="text-sm text-muted mt-1">
          The exact HTML for {edition?.date ?? 'today'}. Slot order and styling are fixed &mdash;
          only contents vary.
        </p>
      </header>

      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside>
          <h2 className="text-xs uppercase tracking-widest text-muted mb-3">Slots</h2>
          <ul className="space-y-1">
            {SLOT_IDS.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <span className="text-sm text-foreground">{SLOT_LABELS[id]}</span>
                {isRegenerable(id) ? (
                  <button
                    type="button"
                    onClick={() => void regenerate(id)}
                    disabled={busy !== null || !edition}
                    className="inline-flex items-center gap-1 text-xs text-acc-blue hover:underline disabled:opacity-40"
                    aria-label={`Regenerate ${SLOT_LABELS[id]}`}
                  >
                    <RefreshCw size={12} className={busy === id ? 'animate-spin' : undefined} />
                    {busy === id ? 'Working' : 'Regenerate'}
                  </button>
                ) : (
                  // STATIC BY CONSTRUCTION. A masthead, a date in a fixed
                  // format and a legal footer have nothing to regenerate — a
                  // button here would be a control that provably does nothing,
                  // which is worse than its absence.
                  <span
                    className="inline-flex items-center gap-1 text-xs text-muted"
                    title="Hardcoded in the template — nothing to regenerate"
                  >
                    <Lock size={12} />
                    Static
                  </span>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <section>
          {html ? (
            <iframe
              title="Newsletter preview"
              srcDoc={html}
              sandbox=""
              className="w-full rounded-xl border border-border bg-white"
              style={{ height: '80vh' }}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted">
              Composing the edition&hellip;
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
