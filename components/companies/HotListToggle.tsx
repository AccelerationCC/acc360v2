'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface HotListToggleProps {
  companyId: string
  companyName: string
  onHotList: boolean
  onChange: (next: boolean) => void
  /** 'button' = labelled action button, 'icon' = compact flame for card rows */
  variant?: 'button' | 'icon'
  className?: string
}

/**
 * Adds/removes a company from the Hot List. Never deletes the record —
 * the company stays on the target list either way.
 */
export function HotListToggle({
  companyId,
  companyName,
  onHotList,
  onChange,
  variant = 'button',
  className,
}: HotListToggleProps) {
  const [saving, setSaving] = useState(false)
  const next = !onHotList
  const label = onHotList ? 'Remove from Hot List' : 'Add to Hot List'

  async function handleClick() {
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/hotlist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onHotList: next }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Update failed')
      }

      onChange(next)
      toast.success(
        next
          ? `"${companyName}" added to the Hot List`
          : `"${companyName}" removed from the Hot List — still on the target list`
      )
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  const active =
    'bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25'
  const inactive =
    'bg-transparent text-muted border-border hover:text-orange-400 hover:border-orange-500/30'

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={saving}
        title={label}
        aria-label={label}
        aria-pressed={onHotList}
        className={cn(
          'shrink-0 flex items-center justify-center w-8 py-1.5 rounded-xl border transition-all duration-[1200ms] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
          onHotList ? active : inactive,
          className
        )}
      >
        {saving ? <LoadingSpinner size="sm" /> : <Flame size={12} />}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={saving}
      aria-pressed={onHotList}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium border transition-all duration-[2000ms] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
        onHotList ? active : inactive,
        className
      )}
    >
      {saving ? <LoadingSpinner size="sm" /> : <Flame size={13} />}
      {label}
    </button>
  )
}
