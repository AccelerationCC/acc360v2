import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCompany, updateCompany, deleteCompany, airtableError } from '@/lib/airtable'
import { requireAdmin } from '@/lib/adminGuard'
import { requireExec } from '@/lib/execGuard'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 360 tier, not just a signed-in session. These reads return real company
  // data, and until now they checked userId alone — an `hr` account or one with
  // no role could fetch all of it directly. Page-level gating alone would have
  // left this path open.
  const guard = await requireExec()
  if (guard) return guard

  try {
    const company = await getCompany(params.id)
    return NextResponse.json(company)
  } catch (err) {
    console.error('[GET /api/companies/:id]', err)
    return NextResponse.json({ error: 'Company not found', details: String(err) }, { status: 404 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard) return guard

  try {
    const fields = await req.json()
    const company = await updateCompany(params.id, fields)
    return NextResponse.json(company)
  } catch (err) {
    const { type, message, status } = airtableError(err)
    console.error('[PATCH /api/companies/:id]', type, message)
    return NextResponse.json(
      { error: 'Failed to update company', airtableError: type, details: message },
      { status },
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard) return guard

  try {
    await deleteCompany(params.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/companies/:id]', err)
    return NextResponse.json({ error: 'Failed to delete company', details: String(err) }, { status: 500 })
  }
}
