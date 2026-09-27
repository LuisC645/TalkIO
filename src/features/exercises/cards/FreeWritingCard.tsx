import { useEffect, useRef, useState } from 'react'
import { Meter } from '@/components/ui/Meter'
import { cn } from '@/lib/cn'
import { countWords, liveHints } from '@/lib/writingChecklist'
import type { FreeWritingPayload } from '@/features/lessons/types'
import { type CardProps } from '../shared'

const TEMPLATE = ['Answer', 'Reason · because…', 'Example · for example…', 'Closing · so… / that’s why…']
export const MIN_WORDS_TO_SEND = 10

/**
 * Escritura libre: pregunta en inglés, preguntas guía, la plantilla Answer → Reason →
 * Example → Closing, contador de palabras con meta y el checklist de writing en vivo.
 */
export function FreeWritingCard({ payload, onChange, attempt }: CardProps<FreeWritingPayload>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // El borrador vive aquí: la respuesta solo se reporta al padre cuando ya es enviable
  const [draft, setDraft] = useState('')
  const text = attempt ? ('text' in attempt.response ? attempt.response.text : '') : draft
  const words = countWords(text)
  const hints = attempt ? [] : liveHints(text)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 180)}px`
  }, [text])

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[clamp(1.25rem,1.1rem+0.7vw,1.625rem)] leading-[1.35] font-semibold tracking-[-0.015em]" lang="en">
        {payload.prompt}
      </p>

      {payload.guiding_questions.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-callout text-label-2">
          {payload.guiding_questions.map((q) => (
            <li key={q} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-label-3" />
              {q}
            </li>
          ))}
        </ul>
      )}

      <ol aria-label="Estructura sugerida" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEMPLATE.map((step, i) => (
          <li key={step} className="rounded-xl bg-fill/70 px-3 py-2 text-footnote">
            <span className="font-semibold text-label">{i + 1}. </span>
            <span className="text-label-2" lang="en">
              {step}
            </span>
          </li>
        ))}
      </ol>

      <textarea
        ref={ref}
        aria-label="Tu respuesta"
        value={text}
        readOnly={!!attempt}
        lang="en"
        placeholder="Write your answer in English…"
        onChange={(e) => {
          setDraft(e.target.value)
          onChange(countWords(e.target.value) >= MIN_WORDS_TO_SEND ? { text: e.target.value } : null)
        }}
        className={cn(
          'min-h-[180px] w-full resize-none rounded-2xl border bg-surface px-4 py-3.5 text-body leading-[1.6] text-label outline-none placeholder:text-label-2/80',
          'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)]',
          attempt ? 'border-separator' : 'border-field-border',
        )}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Meter value={words} max={payload.min_words} label="Palabras escritas frente al mínimo" className="flex-1" />
          <span className="shrink-0 text-footnote font-medium text-label-2 tabular-nums">
            {words} / {payload.min_words} palabras
          </span>
        </div>
        {hints.length > 0 && (
          <ul aria-live="polite" className="flex flex-wrap gap-2">
            {hints.map((h) => (
              <li key={h.id} className="appear flex items-center gap-1.5 rounded-full bg-streak/10 px-3 py-1 text-footnote font-medium text-streak">
                <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 fill-current">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.25a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V5A.75.75 0 0 1 8 4.25Zm0 7.5a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
                </svg>
                {h.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
