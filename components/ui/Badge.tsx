import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'orange' | 'yellow' | 'pale' | 'teal' | 'red' | 'blue'
  className?: string
}

// The newsroom's chip vocabulary: a 15%-alpha tint of the accent behind
// full-strength accent text, rather than a solid fill with inverted text.
// The accent tokens are the contrast-measured light-mode values, and
// text-on-own-/15-tint is the case those measurements were taken for
// (4.61:1 on the page, 4.83:1 on a card) — so this pairing is the one that
// was verified, not an approximation of it.
//
// The old orange/yellow/pale/teal quartet collapses to two: bronze and gold.
// They are kept as distinct variant NAMES so no call site has to change,
// but teal no longer renders sage — it was retired with the palette.
const variants = {
  default: 'bg-foreground/5 text-foreground/70 border border-border',
  orange:  'bg-acc-blue/15 text-acc-blue',
  yellow:  'bg-acc-gold/15 text-acc-gold',
  pale:    'bg-acc-blue/10 text-acc-blue',
  teal:    'bg-muted-ink/15 text-muted-ink',
  red:     'bg-red-500/10 text-red-700 border border-red-500/20',
  blue:    'bg-acc-gold/10 text-acc-gold border border-acc-gold/20',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
