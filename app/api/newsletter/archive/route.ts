import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getArchiveDates } from '@/lib/kv'
import { requireExec } from '@/lib/execGuard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 360 tier, matching /api/newsletter next door. This route was the odd one
  // out — a signed-in account of any role could enumerate the newsletter
  // archive. Pinned by lib/execGate.test.ts.
  const guard = await requireExec()
  if (guard) return guard

  const dates = await getArchiveDates()
  return NextResponse.json({ dates })
}
