import { NextRequest, NextResponse } from 'next/server'
import { getAllCompanies } from '@/lib/airtable'
import { getCompanyNews } from '@/lib/newsroom'
import type { NewsroomDebug } from '@/lib/newsroom'
import { getNewsletter, saveNewsletter } from '@/lib/kv'
import { isForceRequested, shouldRefuseGeneration } from '@/lib/newsletterGuard'
import { getCompanyName, extractUrl } from '@/lib/utils'
import type { Newsletter, NewsletterCompanySection } from '@/types/newsletter'

// Vercel Hobby plan maximum for serverless functions is 60 seconds.
// 8 sequential web searches (~20s each) would exceed that, so companies run in parallel
// via Promise.allSettled — same per-company resilience as sequential, fits within 60s.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Fires at 11:00 UTC = 6am EST (winter) / 7am EDT (summer). Vercel Cron does not
// guarantee sub-minute accuracy; exact timing varies by a few minutes.
// Configured in vercel.json: { "schedule": "0 11 * * *" }

function domainFromWebsite(website?: string): string | undefined {
  if (!website) return undefined
  try {
    const u = website.startsWith('http') ? website : `https://${website}`
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export async function GET(req: NextRequest) {
  // Vercel Cron passes the secret in the Authorization header.
  // Reject any caller that doesn't have it.
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[newsletter/generate] ANTHROPIC_API_KEY is not set')
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // IDEMPOTENCY GUARD. Refuse if today's newsletter already exists.
  //
  // Provenance: on 2026-09-01 this endpoint was called twice while verifying
  // that the cron path needed its /360 prefix — 18:50:55 and 18:52:00, both
  // 200, both completing all eight briefs. The second run overwrote the first
  // and the two disagreed: 3CV 6 articles vs 8, Erich & Kallman 6 vs 8, LV8
  // 5 vs 6, Hello There Collective 4 vs 5, with different prose throughout.
  // Nothing in the route objected, because nothing asked.
  //
  // 409, not a silent 200: a second call in the same day is not normal
  // operation and should be visible in the logs rather than swallowed. In
  // ordinary daily operation this branch never runs.
  //
  // FAILS OPEN BY DESIGN. getNewsletter swallows its errors and returns null,
  // so a KV outage reads as "nothing generated yet" and the run proceeds. That
  // is the deliberate direction: for a once-a-day newsletter, regenerating on a
  // KV blip is a smaller loss than skipping the day entirely. The guard stops
  // accidents, and is not a mutual exclusion lock — two calls racing inside the
  // same ~60s window can both pass it.
  const force = isForceRequested(req.nextUrl.searchParams.get('force'))
  const alreadyExists = force ? false : Boolean(await getNewsletter(today))
  if (shouldRefuseGeneration({ force, alreadyExists })) {
    console.warn(`[newsletter/generate] refused: newsletter:${today} already exists`)
    return NextResponse.json(
      {
        error: 'Already generated',
        date: today,
        hint: 'Pass ?force=1 to regenerate and overwrite.',
      },
      { status: 409 },
    )
  }

  try {
    const all = await getAllCompanies()
    const hotList = all.filter((c) => Boolean(c.fields['On Hot List']))

    if (hotList.length === 0) {
      return NextResponse.json({ error: 'No Hot List companies found' }, { status: 404 })
    }

    // TEMP DEBUG: collect per-company debug info to surface in the response body.
    const debugEntries: (NewsroomDebug & { rejected?: string })[] = []

    // Run all companies in parallel. Promise.allSettled isolates failures per company.
    const settled = await Promise.allSettled(
      hotList.map(async (company): Promise<NewsletterCompanySection> => {
        const f        = company.fields
        const name     = getCompanyName(f)
        const website  = extractUrl(f['Website'] as string | undefined)
        const domain   = domainFromWebsite(website)
        const vertical = (f['Vertical'] as string | undefined) ?? undefined
        const hq       = ((f['HQ'] ?? f['HQ (verified)']) as string | undefined) ?? undefined
        const contact  = (f['Contact'] as string | undefined) ?? undefined

        const t0  = Date.now()
        const dbg: NewsroomDebug = { company: name }
        try {
          const result = await getCompanyNews({ name, domain, vertical, hq, contact }, dbg)
          // elapsedMs set inside getCompanyNews; fallback in case it wasn't reached
          if (dbg.elapsedMs == null) dbg.elapsedMs = Date.now() - t0
          debugEntries.push(dbg)
          return { companyId: company.id, companyName: name, domain, result }
        } catch (err: any) {
          if (dbg.elapsedMs == null) dbg.elapsedMs = Date.now() - t0
          // Only set thrownError here if getCompanyNews didn't already populate it
          // (getCompanyNews sets it for Anthropic SDK errors with HTTP status + body)
          if (!dbg.thrownError) {
            const httpStatus = err?.status != null ? ` [HTTP ${err.status}]` : ''
            const errBody    = err?.error  != null ? ` body=${JSON.stringify(err.error)}` : ''
            dbg.thrownError  = `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}${httpStatus}${errBody}`
          }
          console.error(`[newsletter/generate] company="${name}" failed: ${dbg.thrownError}`)
          debugEntries.push(dbg)
          throw err
        }
      }),
    )

    const sections: NewsletterCompanySection[] = []
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        sections.push(r.value)
      } else {
        // rejection already captured in debugEntries via the catch above
      }
    }

    const newsletter: Newsletter = {
      date: today,
      generatedAt: new Date().toISOString(),
      sections,
      companiesAttempted: hotList.length,
      companiesSucceeded: sections.length,
    }

    const saved = await saveNewsletter(newsletter)

    return NextResponse.json({
      ok: true,
      date: today,
      companiesAttempted: newsletter.companiesAttempted,
      companiesSucceeded: newsletter.companiesSucceeded,
      saved,
      // TEMP DEBUG — remove once Vercel issue is diagnosed
      debug: debugEntries,
    })
  } catch (err) {
    console.error('[newsletter/generate]', err)
    return NextResponse.json(
      { error: 'Generation failed', details: err instanceof Error ? err.message : undefined },
      { status: 500 },
    )
  }
}
