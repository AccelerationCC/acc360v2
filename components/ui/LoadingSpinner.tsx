import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full border-current border-t-transparent animate-spin',
        sizes[size],
        className
      )}
      aria-label="Loading…"
    />
  )
}

/** Full-page loading overlay */
export function PageLoader({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <LoadingSpinner size="lg" className="text-acc-blue" />
      <p className="text-muted text-sm">{message}</p>
    </div>
  )
}
