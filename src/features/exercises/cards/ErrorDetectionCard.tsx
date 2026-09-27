import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { ErrorDetectionPayload } from '@/features/lessons/types'
import { resultTone, sentenceClass } from '../helpers'
import { type CardProps } from '../shared'

/**
 * Detectar y corregir: la oración con el error aparece arriba y el campo viene precargado
 * con ella para editar solo lo necesario. "Comprobar" se habilita cuando hay un cambio.
 */
export function ErrorDetectionCard({ payload, onChange, attempt, onSubmit }: CardProps<ErrorDetectionPayload>) {
  const [draft, setDraft] = useState(payload.sentence)
  const ref = useRef<HTMLTextAreaElement>(null)
  const text = attempt && 'text' in attempt.response ? attempt.response.text : draft

  useEffect(() => {
    if (attempt) return
    const el = ref.current
    el?.focus({ preventScroll: true })
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [attempt])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger/5 px-5 py-4">
        <svg aria-hidden viewBox="0 0 20 20" className="mt-1.5 size-5 shrink-0 fill-none stroke-danger stroke-[1.8]">
          <path d="M10 6.5v4.5m0 2.5v.01M8.3 3.3 2.2 14a2 2 0 0 0 1.7 3h12.2a2 2 0 0 0 1.7-3L11.7 3.3a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className={sentenceClass}>{payload.sentence}</p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-footnote font-medium text-label-2">Escríbela corregida</span>
        <textarea
          ref={ref}
          rows={2}
          value={text}
          readOnly={!!attempt}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value)
            const changed = e.target.value.trim() && e.target.value.trim() !== payload.sentence.trim()
            onChange(changed ? { text: e.target.value } : null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit()
            }
          }}
          className={cn(
            'w-full resize-none rounded-2xl border bg-surface px-4 py-3 text-body text-label outline-none',
            'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)]',
            attempt ? resultTone(attempt) : 'border-field-border',
          )}
        />
      </label>
    </div>
  )
}
