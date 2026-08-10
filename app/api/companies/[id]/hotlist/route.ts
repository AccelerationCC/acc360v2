import { NextRequest, NextResponse } from 'next/server'
import { setHotList } from '@/lib/airtable'
import { requireAdmin } from '@/lib/adminGuard'

interface Params { params: { id: string } }

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

    const company = await setHotList(params.id, onHotList)
    return NextResponse.json(company)
  } catch (err) {
    console.error('[PATCH /api/companies/:id/hotlist]', err)
    return NextResponse.json({ error: 'Failed to update Hot List', details: String(err) }, { status: 500 })
  }
}
