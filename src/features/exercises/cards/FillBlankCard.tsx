import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import type { FillBlankPayload } from '@/features/lessons/types'
import { highlight, resultTone, sentenceClass, splitBlank } from '../helpers'
import { type CardProps } from '../shared'

/**
 * Completar huecos (fill_blank) y contraste de tiempos (tense_contrast): el campo va DENTRO
 * de la oración, con ancho según lo escrito. En tense_contrast se muestra el verbo base
 * entre paréntesis y se resalta la pista temporal (contraste explícito, como pide el seed).
 */
export function FillBlankCard({ payload, value, onChange, attempt, onSubmit }: CardProps<FillBlankPayload>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const text = attempt ? ('text' in attempt.response ? attempt.response.text : '') : value && 'text' in value ? value.text : ''
  const [before, after] = splitBlank(payload.sentence)

  useEffect(() => {
    if (!attempt) inputRef.current?.focus({ preventScroll: true })
  }, [attempt])

  return (
    <div className="flex flex-col gap-4">
      <p className={cn(sentenceClass, 'leading-[2.1]')}>
        {highlight(before, payload.time_clue)}
        <span className="inline-flex items-baseline gap-1 align-baseline">
          <input
            ref={inputRef}
            aria-label="Tu respuesta"
            value={text}
            readOnly={!!attempt}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value.trim() ? { text: e.target.value } : null)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            style={{ width: `${Math.max(6, text.length + 2)}ch` }}
            className={cn(
              'mx-1 max-w-full border-b-2 bg-transparent px-1 text-center font-semibold outline-none transition-colors duration-150',
              // El foco se marca con el subrayado (más grueso y azul), sin el recuadro global
              'focus:border-b-[3px] focus:border-accent focus-visible:outline-none',
              attempt ? resultTone(attempt) : 'border-label-3 text-accent-text',
            )}
          />
          {payload.verb && <span className="text-label-2">({payload.verb})</span>}
        </span>
        {highlight(after, payload.time_clue)}
      </p>
      {payload.time_clue && (
        <p className="text-footnote text-label-2">
          Fíjate en la pista de tiempo: <span className="font-semibold text-label">“{payload.time_clue}”</span>
        </p>
      )}
    </div>
  )
}
