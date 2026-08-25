import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getTableSchema } from '@/lib/airtable'
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

  try {
    const schema = await getTableSchema()
    return NextResponse.json(schema)
  } catch (err) {
    console.error('[GET /api/airtable/schema]', err)
    return NextResponse.json({ error: 'Failed to fetch schema', details: String(err) }, { status: 500 })
  }
}
