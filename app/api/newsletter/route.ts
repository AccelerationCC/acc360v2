import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getNewsletter, getMostRecentNewsletter } from '@/lib/kv'
import { requireExec } from '@/lib/execGuard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 360 tier, not just a signed-in session. These reads return real company
  // data, and until now they checked userId alone — an `hr` account or one with
  // no role could fetch all of it directly. Page-level gating alone would have
  // left this path open.
  const guard = await requireExec()
  if (guard) return guard

  const today = new Date().toISOString().slice(0, 10)
  const date  = req.nextUrl.searchParams.get('date')

  if (date) {
    const newsletter = await getNewsletter(date)
    if (!newsletter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ newsletter, date, isToday: date === today })
  }

  // No date — try today first, fall back to most recent
  const todaysLetter = await getNewsletter(today)
  if (todaysLetter) {
    return NextResponse.json({ newsletter: todaysLetter, date: today, isToday: true })
  }

  const recent = await getMostRecentNewsletter()
  if (recent) {
    return NextResponse.json({ newsletter: recent.newsletter, date: recent.date, isToday: false })
  }

  return NextResponse.json({ newsletter: null, date: today, isToday: true })
}
