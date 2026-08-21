'use client'

import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

// Mirrors the newsroom's FIELD style (hr-ui.tsx): the card surface rather
// than the page colour, an alpha border, and the bronze ring on focus.
const baseInput = [
  'w-full rounded-lg bg-surface border border-input text-foreground placeholder-muted-foreground px-3 py-2 text-sm',
  'focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent transition-colors duration-200',
].join(' ')

// ─── Text Input ───────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-foreground">{label}</label>}
        <input ref={ref} id={inputId}
          className={cn(baseInput, error && 'border-red-500 focus:ring-red-500', className)}
          {...props}
        />
        {hint && !error && <p className="text-xs font-light text-muted">{hint}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-foreground">{label}</label>}
        <textarea ref={ref} id={inputId} rows={4}
          className={cn(baseInput, 'resize-y', error && 'border-red-500 focus:ring-red-500', className)}
          {...props}
        />
        {hint && !error && <p className="text-xs font-light text-muted">{hint}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: string[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, options, placeholder = 'Select…', ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-foreground">{label}</label>}
        <select ref={ref} id={inputId}
          className={cn(baseInput, 'cursor-pointer', error && 'border-red-500 focus:ring-red-500', className)}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {hint && !error && <p className="text-xs font-light text-muted">{hint}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
