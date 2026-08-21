'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from './LoadingSpinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      icon,
      children,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-[1200ms] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.97]'

    // Mirrors the newsroom's BUTTON_VARIANTS (hr-ui.tsx): a solid bronze
    // primary with white text, and everything else an alpha-on-foreground
    // outline or wash. The heavy black drop shadows are gone — they were
    // tuned for a charcoal page and read as grime on cream.
    const variants = {
      primary:
        'bg-acc-blue text-white hover:opacity-90',
      secondary:
        'border border-foreground/10 text-foreground/70 hover:border-foreground/30 hover:text-foreground',
      ghost:
        'bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground',
      danger:
        'border border-red-500/30 text-red-700 hover:bg-red-500/10',
      outline:
        'bg-transparent border border-foreground/10 text-foreground hover:border-acc-blue',
    }

    const sizes = {
      sm: 'text-xs px-3 py-1.5',
      md: 'text-sm px-4 py-2',
      lg: 'text-base px-6 py-3',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size="sm" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
