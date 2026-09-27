import { useEffect } from 'react'
import { cn } from '@/lib/cn'
import type { MultipleChoicePayload } from '@/features/lessons/types'
import { sentenceClass, splitBlank } from '../helpers'
import { ResultIcon, type CardProps } from '../shared'

const LETTERS = ['A', 'B', 'C', 'D']

/**
 * Opción múltiple: opciones grandes tipo lista (≥ 52px), atajos de teclado 1–4 / A–D.
 * Al calificar: la correcta en verde con check, la elegida incorrecta en rojo con ×.
 */
export function MultipleChoiceCard({ payload, value, onChange, attempt }: CardProps<MultipleChoicePayload>) {
  const chosen = attempt ? ('choice' in attempt.response ? attempt.response.choice : -1) : value && 'choice' in value ? value.choice : -1
  const correctText = attempt?.feedback.corrected ?? null

  useEffect(() => {
    if (attempt) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const n = Number(e.key) - 1
      const l = LETTERS.indexOf(e.key.toUpperCase())
      const i = n >= 0 && n < payload.options.length ? n : l >= 0 && l < payload.options.length ? l : -1
      if (i >= 0) onChange({ choice: i })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [attempt, onChange, payload.options.length])

  const [before, after] = payload.sentence ? splitBlank(payload.sentence) : ['', '']

  return (
    <div className="flex flex-col gap-5">
      {payload.sentence && (
        <p className={sentenceClass}>
          {before}
          {payload.sentence.includes('___') && (
            <span className="mx-1 inline-block min-w-16 border-b-2 border-accent align-baseline">&nbsp;</span>
          )}
          {after}
        </p>
      )}
      <div role="radiogroup" aria-label="Opciones" className="flex flex-col gap-2.5">
        {payload.options.map((option, i) => {
          const selected = chosen === i
          const isCorrect = !!attempt && option === correctText
          const isWrongChoice = !!attempt && selected && !attempt.is_correct
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!!attempt}
              onClick={() => onChange({ choice: i })}
              className={cn(
                'flex min-h-13 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-body',
                'transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.98] disabled:active:scale-100',
                !attempt && (selected ? 'border-accent bg-accent/8' : 'border-separator hover:border-field-border hover:bg-fill/50'),
                isCorrect && 'animate-settle border-success bg-success/10',
                isWrongChoice && 'animate-settle border-danger bg-danger/8',
                attempt && !isCorrect && !isWrongChoice && 'border-separator opacity-60',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-footnote font-semibold',
                  selected && !attempt ? 'bg-accent text-white' : 'bg-fill text-label-2',
                  isCorrect && 'bg-success text-white',
                  isWrongChoice && 'bg-danger text-white',
                )}
              >
                {isCorrect ? <ResultIcon correct className="size-4" /> : isWrongChoice ? <ResultIcon correct={false} className="size-4" /> : LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1">{option}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
