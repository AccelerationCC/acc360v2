'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { Loader2 } from 'lucide-react'

interface ChartDataPoint {
  name: string
  value: number
}

interface ChartSpec {
  type: 'bar' | 'line'
  title?: string
  data: ChartDataPoint[]
}

// The newsroom's chart series tokens. Recharts needs concrete values rather
// than CSS classes, so these read the custom properties at module scope —
// same source as every other colour in the app.
const CHART = (n: number) =>
  `var(--chart-${n})`
const BAR_COLORS = [CHART(1), CHART(2), CHART(3), CHART(4)]

const AXIS_TICK = { fill: 'var(--color-muted-ink)', fontSize: 11 } as const

const TOOLTIP_PROPS = {
  cursor: { fill: 'var(--muted)' },
  contentStyle: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
    padding: '6px 10px',
  },
  labelStyle: { color: 'var(--foreground)', marginBottom: 2 },
  itemStyle: { color: 'var(--color-acc-blue)' },
}

function BarView({ spec }: { spec: ChartSpec }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={spec.data} margin={{ top: 4, right: 12, left: -10, bottom: 4 }}>
        <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_PROPS} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {spec.data.map((_, idx) => (
            <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function LineView({ spec }: { spec: ChartSpec }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={spec.data} margin={{ top: 4, right: 12, left: -10, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
        <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_PROPS} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ fill: 'var(--chart-1)', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface Props {
  content: string
}

export function ChartBlock({ content }: Props) {
  let spec: ChartSpec | null = null
  try {
    const parsed = JSON.parse(content.trim())
    if (parsed?.type && Array.isArray(parsed?.data) && parsed.data.length > 0) {
      spec = parsed as ChartSpec
    }
  } catch {
    // JSON incomplete — still streaming
  }

  if (!spec) {
    return (
      <div className="my-4 rounded-lg border border-border/40 bg-card/10 px-4 py-3 flex items-center gap-2">
        <Loader2 size={12} className="animate-spin shrink-0 text-muted" />
        <span className="text-xs text-muted">Preparing chart…</span>
      </div>
    )
  }

  return (
    <div className="my-4 rounded-lg border border-border bg-card/20 px-4 pt-4 pb-2">
      {spec.title && (
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
          {spec.title}
        </p>
      )}
      {spec.type === 'bar' && <BarView spec={spec} />}
      {spec.type === 'line' && <LineView spec={spec} />}
    </div>
  )
}
