import { CheckIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { ReviewItem } from '../api'

const KIND: Record<string, string> = {
  word: 'Palabra',
  collocation: 'Colocación',
  false_friend: 'Falso amigo',
  phrasal_verb: 'Phrasal verb',
  expression: 'Expresión',
  structure: 'Estructura',
}

/**
 * Tarjeta de repaso. Frente: la pista en español (o el error). Reverso: la forma correcta.
 * La respuesta aparece con fundido + desenfoque suave (emil-design-eng › blur para
 * enmascarar el cambio) y sin mover el layout del frente.
 */
export function Flashcard({ item, revealed }: { item: ReviewItem; revealed: boolean }) {
  const isNew = item.state === 0
  return (
    <article className="flex min-h-[22rem] flex-col rounded-[28px] bg-surface p-6 sm:min-h-[26rem] sm:p-10">
      <div className="flex items-center gap-2 text-footnote font-medium text-label-2">
        <span className="rounded-full bg-fill px-2.5 py-1 text-label">
          {item.item_type === 'vocab' ? (KIND[item.vocab?.kind ?? ''] ?? 'Vocabulario') : 'Error frecuente'}
        </span>
        {isNew && <span className="rounded-full bg-accent/10 px-2.5 py-1 font-semibold text-accent-text">Nueva</span>}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6 py-8">
        {item.item_type === 'vocab' && item.vocab ? <VocabFace item={item} revealed={revealed} /> : null}
        {item.item_type === 'pattern' && item.pattern ? <PatternFace item={item} revealed={revealed} /> : null}
        {!item.vocab && !item.pattern && <p className="text-callout text-label-2">Esta tarjeta ya no tiene contenido.</p>}
      </div>
    </article>
  )
}

function Answer({ revealed, children }: { revealed: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!revealed}
      className={cn(
        'flex flex-col gap-3 border-t border-separator pt-6 transition-[opacity,filter,transform] duration-300 ease-out motion-reduce:transition-opacity',
        revealed ? 'opacity-100 blur-0' : 'pointer-events-none translate-y-1 opacity-0 blur-[6px] select-none',
      )}
    >
      {children}
    </div>
  )
}

function VocabFace({ item, revealed }: { item: ReviewItem; revealed: boolean }) {
  const v = item.vocab!
  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-callout text-label-2">¿Cómo se dice en inglés?</p>
        <p className="font-display text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)] leading-[1.15] font-bold tracking-[-0.025em] text-balance">
          {v.translation ?? v.wrong_form ?? '—'}
        </p>
        {v.wrong_form && (
          <p className="text-callout text-label-2">
            Evita: <span className="text-danger line-through decoration-2" lang="en">{v.wrong_form}</span>
          </p>
        )}
      </div>
      <Answer revealed={revealed}>
        <p className="flex items-start gap-2 font-display text-[clamp(1.5rem,1.25rem+1vw,2rem)] leading-[1.2] font-semibold text-balance" lang="en">
          <CheckIcon className="mt-1.5 size-5 shrink-0 text-success" />
          {v.term}
        </p>
        {v.example && (
          <p className="text-body text-label-2" lang="en">
            “{v.example}”
          </p>
        )}
        {v.notes && <p className="text-callout text-label-2">{v.notes}</p>}
      </Answer>
    </>
  )
}

function PatternFace({ item, revealed }: { item: ReviewItem; revealed: boolean }) {
  const p = item.pattern!
  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-callout text-label-2">{p.example ? '¿Cómo la corregirías?' : '¿Recuerdas la regla?'}</p>
        <p className="font-display text-title-2 font-semibold">{p.title}</p>
        {p.example && (
          <p className="font-display text-[clamp(1.5rem,1.25rem+1vw,2rem)] leading-[1.25] font-semibold text-balance" lang="en">
            {p.example.wrong}
          </p>
        )}
      </div>
      <Answer revealed={revealed}>
        {p.example && (
          <p className="flex items-start gap-2 font-display text-[clamp(1.375rem,1.2rem+0.8vw,1.75rem)] leading-[1.25] font-semibold" lang="en">
            <CheckIcon className="mt-1.5 size-5 shrink-0 text-success" />
            {p.example.right}
          </p>
        )}
        <p className="text-body leading-[1.55] text-label-2">{p.rule}</p>
      </Answer>
    </>
  )
}
