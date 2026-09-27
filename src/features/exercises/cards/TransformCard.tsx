import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import type { TransformPayload } from '@/features/lessons/types'
import { resultTone, sentenceClass } from '../helpers'
import { type CardProps } from '../shared'

/**
 * Transformar: la oración original como cita, una etiqueta con la forma pedida
 * ("→ negativa") y un campo de una línea para la nueva versión.
 */
export function TransformCard({ payload, value, onChange, attempt, onSubmit }: CardProps<TransformPayload>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const text = attempt ? ('text' in attempt.response ? attempt.response.text : '') : value && 'text' in value ? value.text : ''

  useEffect(() => {
    if (!attempt) inputRef.current?.focus({ preventScroll: true })
  }, [attempt])

  return (
    <div className="flex flex-col gap-4">
      <blockquote className="rounded-2xl bg-fill/70 px-5 py-4">
        <p className={sentenceClass}>{payload.sentence}</p>
      </blockquote>
      {payload.target_form && (
        <div className="flex items-center gap-2 text-callout text-label-2">
          <svg aria-hidden viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-[1.8]">
            <path d="M10 4v12m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Escríbela en forma <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-semibold text-accent-text">{payload.target_form}</span>
        </div>
      )}
      <input
        ref={inputRef}
        aria-label="Tu versión"
        value={text}
        readOnly={!!attempt}
        autoComplete="off"
        spellCheck={false}
        placeholder="Escribe la oración completa"
        onChange={(e) => onChange(e.target.value.trim() ? { text: e.target.value } : null)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        className={cn(
          'h-14 w-full rounded-2xl border bg-surface px-4 text-body text-label placeholder:text-label-2/80 outline-none',
          'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)]',
          attempt ? resultTone(attempt) : 'border-field-border',
        )}
      />
    </div>
  )
}
