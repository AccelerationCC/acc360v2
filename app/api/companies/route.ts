import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAllCompanies, createCompany, airtableError } from '@/lib/airtable'
import { requireAdmin } from '@/lib/adminGuard'
import { requireExec } from '@/lib/execGuard'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 360 tier, not just a signed-in session. These reads return real company
  // data, and until now they checked userId alone — an `hr` account or one with
  // no role could fetch all of it directly. Page-level gating alone would have
  // left this path open.
  const guard = await requireExec()
  if (guard) return guard

  // Diagnostic: log the env values actually seen at runtime (no secret values)
  console.log('[/api/companies] AIRTABLE_BASE_ID =', process.env.AIRTABLE_BASE_ID ?? '⚠️ MISSING')
  console.log('[/api/companies] AIRTABLE_TABLE_NAME =', process.env.AIRTABLE_TABLE_NAME ?? '⚠️ MISSING')
  console.log('[/api/companies] AIRTABLE_API_KEY prefix =', process.env.AIRTABLE_API_KEY?.slice(0, 16) ?? '⚠️ MISSING')

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
    const fields = await req.json()
    const company = await createCompany(fields)
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
