import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { requireExec } from '@/lib/execGuard'
import { buildEdition, regenerateSlot } from '@/lib/newsletterEdition'
import { renderNewsletterHtml } from '@/lib/renderNewsletter'
import { REGENERABLE_SLOTS, type NewsletterEdition, type RegenerableSlotId } from '@/types/newsletterTemplate'

// The template renderer needs Node, not the edge runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Same gate as /api/newsletter next door: a signed-in session is not enough. */
async function gate() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return requireExec()
}

/** GET — compose today's (or ?date=) edition and return its HTML plus the data. */
export async function GET(req: NextRequest) {
  const denied = await gate()
  if (denied) return denied

  const param = req.nextUrl.searchParams.get('date')
  if (param && !ISO_DATE.test(param)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }
  const date = param ?? new Date().toISOString().slice(0, 10)
  const edition = await buildEdition(date)
  return NextResponse.json({ edition, html: await renderNewsletterHtml(edition) })
}

/**
 * POST — regenerate exactly one slot of an edition the caller already holds.
 *
 * The caller sends the edition back rather than the server re-composing it,
 * which is what makes "regenerating one slot leaves the others untouched" true
 * of the REQUEST and not merely of the helper: the untouched slots are the ones
 * the client already had, passed through unchanged.
 */
export async function POST(req: NextRequest) {
  const denied = await gate()
  if (denied) return denied

  let body: { edition?: NewsletterEdition; slot?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const slot = body.slot
  if (!slot || !(REGENERABLE_SLOTS as readonly string[]).includes(slot)) {
    return NextResponse.json(
      { error: `slot must be one of: ${REGENERABLE_SLOTS.join(', ')}` },
      { status: 400 },
    )
  }
  const edition = body.edition
  if (!edition || typeof edition.date !== 'string' || !ISO_DATE.test(edition.date)) {
    return NextResponse.json({ error: 'edition with a YYYY-MM-DD date is required' }, { status: 400 })
  }

  const next = await regenerateSlot(edition, slot as RegenerableSlotId)
  return NextResponse.json({ edition: next, html: await renderNewsletterHtml(next) })
}
