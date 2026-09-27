import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { ReorderPayload } from '@/features/lessons/types'
import { type CardProps } from '../shared'

/**
 * Ordenar la oración: se toca una ficha para pasarla a la línea de respuesta y se toca de
 * nuevo para devolverla (accesible con teclado: son botones). Las fichas se manejan por
 * índice, así que las palabras repetidas funcionan. Solo se reporta la respuesta completa.
 */
export function ReorderCard({ payload, onChange, attempt }: CardProps<ReorderPayload>) {
  const [placed, setPlaced] = useState<number[]>([])

  function update(indices: number[]) {
    setPlaced(indices)
    onChange(indices.length === payload.tokens.length ? { tokens: indices.map((i) => payload.tokens[i]) } : null)
  }

  // Tras calificar se muestra lo que se envió
  const shown = attempt && 'tokens' in attempt.response ? attempt.response.tokens : placed.map((i) => payload.tokens[i])
  const bank = payload.tokens.map((t, i) => ({ t, i })).filter(({ i }) => !placed.includes(i))
  const tile =
    'min-h-11 rounded-xl px-3.5 text-body font-medium transition-[transform,background-color] duration-150 ease-out active:scale-[0.96] disabled:active:scale-100'

  return (
    <div className="flex flex-col gap-5">
      <div
        aria-label="Tu oración"
        className={cn(
          'flex min-h-[4.5rem] flex-wrap content-start items-start gap-2 rounded-2xl border-2 border-dashed p-3 transition-colors duration-150',
          attempt
            ? attempt.is_correct
              ? 'border-success/60 bg-success/5'
              : 'border-danger/60 bg-danger/5'
            : placed.length
              ? 'border-accent/40'
              : 'border-separator',
        )}
      >
        {shown.length === 0 && <span className="px-1 py-2.5 text-callout text-label-2">Toca las palabras en orden…</span>}
        {shown.map((word, pos) => (
          <button
            key={`${word}-${pos}`}
            type="button"
            disabled={!!attempt}
            onClick={() => update(placed.filter((_, p) => p !== pos))}
            aria-label={`Quitar "${word}"`}
            className={cn(tile, 'animate-settle bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.1),0_0_0_1px_var(--separator)]')}
          >
            {word}
          </button>
        ))}
      </div>

      {!attempt && (
        <div className="flex flex-wrap gap-2" aria-label="Palabras disponibles">
          {bank.map(({ t, i }) => (
            <button key={i} type="button" onClick={() => update([...placed, i])} className={cn(tile, 'bg-fill hover:bg-accent/10')}>
              {t}
            </button>
          ))}
          {placed.length > 0 && (
            <button type="button" onClick={() => update([])} className="min-h-11 rounded-xl px-3 text-footnote font-medium text-link hover:underline">
              Reiniciar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
