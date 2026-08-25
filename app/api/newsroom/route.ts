import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCompany } from '@/lib/airtable'
import { getCompanyNews } from '@/lib/newsroom'
import { getCompanyName, extractUrl } from '@/lib/utils'
import { requireExec } from '@/lib/execGuard'

// News should always be fresh — never cache this route.
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // web search + synthesis can take a while

/**
 * GET /api/newsroom?id=<airtableRecordId>
 *
 * Loads the company from Airtable, then runs a live web-search-backed
 * briefing. Fresh on every call by design.
 *
 * You can also POST with an explicit body (name/domain/vertical/...) to
 * test without an Airtable record — useful for the standalone demo.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 360 tier, not just a signed-in session — the same gate every sibling read
  // route carries. This one was missed when the tier was introduced: it returns
  // real company data from Airtable AND spends a live web-search briefing, so
  // any signed-in account of any role could both read client data and burn
  // budget here. Pinned by lib/execGate.test.ts.
  const guard = await requireExec()
  if (guard) return guard

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing company id' }, { status: 400 })
  }

  try {
    const company = await getCompany(id)
    const f = company.fields

    const name = getCompanyName(f)
    const website = extractUrl(f['Website'] as string | undefined)
    const domain = domainFromWebsite(website)
    const vertical = (f['Vertical'] as string | undefined) || undefined
    const hq = (f['HQ'] as string | undefined) || (f['HQ (verified)'] as string | undefined) || undefined
    const contact = (f['Contact'] as string | undefined) || undefined

    const result = await getCompanyNews({ name, domain, vertical, hq, contact })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/newsroom]', err)
    return NextResponse.json(
      { error: 'Failed to pull news', details: err instanceof Error ? err.message : undefined },
      { status: 500 }
    )
  }
}

/**
 * POST /api/newsroom
 * body: { name, domain?, vertical?, hq?, contact? }
 * Direct entry point — bypasses Airtable. Used by the demo page.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Same gate as GET, and if anything this path needed it more: the whole
  // briefing subject comes from the request body, so before this an account of
  // any role could drive an unbounded number of caller-authored web-search
  // briefings with no Airtable record required at all.
  const guard = await requireExec()
  if (guard) return guard

  try {
    const body = await req.json()
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const result = await getCompanyNews({
      name: body.name.trim(),
      domain: body.domain || domainFromWebsite(body.website),
      vertical: body.vertical,
      hq: body.hq,
      contact: body.contact,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/newsroom]', err)
    return NextResponse.json(
      { error: 'Failed to pull news', details: err instanceof Error ? err.message : undefined },
      { status: 500 }
    )
  }
}

function domainFromWebsite(website?: string): string | undefined {
  if (!website) return undefined
  try {
    const u = website.startsWith('http') ? website : `https://${website}`
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}
