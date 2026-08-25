import { NextRequest, NextResponse } from 'next/server'
import { setHotList, airtableError } from '@/lib/airtable'
import { requireAdmin } from '@/lib/adminGuard'

// Next 15+ delivers route params as a Promise; the handler awaits it.
interface Params { params: Promise<{ id: string }> }

/**
 * Toggle Hot List membership only. The company stays on the target list —
 * use DELETE /api/companies/:id if you actually want the record gone.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard) return guard

  try {
    const { onHotList } = await req.json()
    if (typeof onHotList !== 'boolean') {
      return NextResponse.json({ error: 'onHotList must be true or false' }, { status: 400 })
    }

    const { id } = await params
    const company = await setHotList(id, onHotList)
    return NextResponse.json(company)
  } catch (err) {
    const { type, message, status } = airtableError(err)
    console.error('[PATCH /api/companies/:id/hotlist]', type, message)
    return NextResponse.json(
      { error: 'Failed to update Hot List', airtableError: type, details: message },
      { status },
    )
  }
}
