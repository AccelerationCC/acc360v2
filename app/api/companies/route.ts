import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAllCompanies, createCompany, airtableError } from '@/lib/airtable'
import { requireAdmin } from '@/lib/adminGuard'
import { requireExec } from '@/lib/execGuard'
import { companyFieldsSchema, parseMutationBody } from '@/lib/companySchemas'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 360 tier, not just a signed-in session. These reads return real company
  // data, and until now they checked userId alone — an `hr` account or one with
  // no role could fetch all of it directly. Page-level gating alone would have
  // left this path open.
  const guard = await requireExec()
  if (guard) return guard

  // Diagnostic: whether the Airtable env is present, and nothing more.
  //
  // This block used to log the first 16 characters of AIRTABLE_API_KEY on every
  // companies page load — the hottest path in the app. Sixteen characters is
  // not a usable key, but it fingerprints the credential precisely enough to
  // confirm which token an environment holds, which is exactly the capability a
  // log must not grant. The same pattern was removed from client-newsroom on
  // 2026-08-26 (PR #25) after a 10-character prefix there was used to identify a
  // specific production secret without either value being read.
  //
  // Presence is kept: "is it set?" is the real diagnostic and the reason the
  // line was written. Everything past that was a leak with a diagnostic excuse.
  const envState = (v: string | undefined) => (v ? 'defined' : '⚠️ MISSING')
  console.log(
    '[/api/companies] env —',
    'AIRTABLE_BASE_ID', envState(process.env.AIRTABLE_BASE_ID) + ';',
    'AIRTABLE_TABLE_NAME', envState(process.env.AIRTABLE_TABLE_NAME) + ';',
    'AIRTABLE_API_KEY', envState(process.env.AIRTABLE_API_KEY),
  )

  try {
    const companies = await getAllCompanies()
    console.log('[/api/companies] fetched', companies.length, 'records')
    return NextResponse.json(companies)
  } catch (err: any) {
    // Surface the real Airtable error — type, message, and status code
    console.error('[/api/companies] Airtable error type   :', err?.error ?? err?.type ?? 'unknown')
    console.error('[/api/companies] Airtable error message:', err?.message ?? String(err))
    console.error('[/api/companies] Airtable status code  :', err?.statusCode ?? err?.status ?? 'unknown')
    console.error('[/api/companies] Full error object     :', JSON.stringify(err, null, 2))
    return NextResponse.json(
      {
        error: 'Failed to fetch companies',
        airtableError: err?.error ?? err?.type ?? 'unknown',
        details: err?.message ?? String(err),
        statusCode: err?.statusCode ?? err?.status,
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard

  try {
    // Shape and size validation BEFORE Airtable. writableOnly() already drops
    // non-writable field names inside createCompany; this covers the other
    // axis — value types and payload size — so a nested object or a payload
    // bomb is refused here rather than forwarded upstream and billed.
    const parsed = parseMutationBody(companyFieldsSchema, await req.json())
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const company = await createCompany(parsed.data)
    return NextResponse.json(company, { status: 201 })
  } catch (err) {
    const { type, message, status } = airtableError(err)
    console.error('[POST /api/companies]', type, message)
    return NextResponse.json(
      { error: 'Failed to create company', airtableError: type, details: message },
      { status }
    )
  }
}
