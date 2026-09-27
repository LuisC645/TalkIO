import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: ReactNode
  error?: string | null
}

/**
 * Etiqueta visible arriba + placeholder como pista (text-fields.md › Best practices:
 * "include a separate label describing the field"). Error debajo, sin depender solo del color.
 */
export function TextField({ label, hint, error, className, id, ...rest }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-footnote font-medium text-label-2">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 w-full rounded-xl border bg-surface px-4 text-body text-label placeholder:text-label-2/80',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)] focus:outline-none',
          error ? 'border-danger' : 'border-field-border',
        )}
      />
      {error ? (
        <p id={`${inputId}-error`} className="appear flex items-start gap-1.5 text-footnote text-danger">
          <svg aria-hidden viewBox="0 0 16 16" className="mt-px size-3.5 shrink-0 fill-current">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.25a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V5A.75.75 0 0 1 8 4.25Zm0 7.5a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-footnote text-label-2">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
