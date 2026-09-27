import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { ResultIcon } from '@/features/exercises/shared'
import type { GradeResult } from '../types'

type Props = {
  result: GradeResult
  exerciseType: string
  onContinue: () => void
  continueLabel: string
}

/**
 * Hoja inferior de retroalimentación (capa funcional → Liquid Glass grueso). Sube con curva de
 * cajón iOS; "Continuar" responde a Enter. El estado se comunica con icono + texto, no solo color.
 */
export function FeedbackSheet({ result, exerciseType, onContinue, continueLabel }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const f = result.feedback
  const partial = !result.is_correct && result.score >= 0.5
  const tone = result.is_correct ? 'success' : partial ? 'streak' : 'danger'
  const title = result.is_correct ? (result.score >= 1 ? '¡Correcto!' : '¡Bien hecho!') : partial ? 'Casi' : 'No exactamente'
  const isWriting = exerciseType === 'free_writing' || exerciseType === 'speaking_prompt'

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="sheet glass-thick fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] rounded-b-none border-b-0 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-h-[72dvh] max-w-3xl flex-col gap-4 overflow-y-auto px-5 pt-6 pb-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full text-white',
              tone === 'success' ? 'bg-success' : tone === 'streak' ? 'bg-streak' : 'bg-danger',
            )}
          >
            <ResultIcon correct={result.is_correct || partial} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-title-2 font-semibold">{title}</p>
            {isWriting && <p className="text-footnote text-label-2">Puntuación: {Math.round(result.score * 100)}/100</p>}
          </div>
          {result.xp_awarded != null && (
            <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-callout font-semibold text-accent-text">+{result.xp_awarded} XP</span>
          )}
        </div>

        {/* Respuesta correcta (si se falló) */}
        {!result.is_correct && f.corrected && !isWriting && (
          <div className="rounded-2xl bg-surface/70 px-4 py-3">
            <p className="text-footnote font-medium text-label-2">Respuesta correcta</p>
            <p className="text-body font-semibold" lang="en">
              {f.corrected}
            </p>
          </div>
        )}

        {f.note && <p className="text-callout font-medium text-label">{f.note}</p>}
        {f.explanation && <p className="text-callout text-label-2">{f.explanation}</p>}

        {f.errors.length > 0 && (
          <ul className="flex flex-col gap-2">
            {f.errors.map((e, i) => (
              <li key={i} className="rounded-2xl bg-surface/70 px-4 py-3">
                <p className="text-callout" lang="en">
                  <span className="text-danger line-through decoration-2">{e.fragment}</span>
                  {e.correction && (
                    <>
                      <span aria-hidden className="mx-2 text-label-3">→</span>
                      <span className="font-semibold text-success">{e.correction}</span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-footnote text-label-2">{e.explanation}</p>
              </li>
            ))}
          </ul>
        )}

        {isWriting && f.checklist && f.checklist.length > 0 && (
          <div>
            <p className="mb-1.5 text-footnote font-medium text-label-2">Checklist de escritura</p>
            <ul className="flex flex-wrap gap-2">
              {f.checklist.map((c) => (
                <li key={c.code} className="rounded-full bg-streak/10 px-3 py-1 text-footnote font-medium text-streak">
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isWriting && f.corrected && (
          <details className="group rounded-2xl bg-surface/70 px-4 py-3">
            <summary className="cursor-pointer list-none text-callout font-semibold marker:hidden">
              Ver tu texto corregido
              <span aria-hidden className="ml-1 inline-block transition-transform duration-200 group-open:rotate-90">›</span>
            </summary>
            <p className="mt-2 text-callout leading-[1.6] whitespace-pre-wrap" lang="en">
              {f.corrected}
            </p>
          </details>
        )}

        {result.pattern && (
          <p className="flex items-center gap-2 text-footnote text-label-2">
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: result.pattern.mastery_threshold }, (_, i) => (
                <span key={i} className={cn('h-1.5 w-4 rounded-full', i < result.pattern!.correct_streak ? 'bg-accent' : 'bg-accent/15 dark:bg-accent/30')} />
              ))}
            </span>
            {result.pattern.status === 'mastered'
              ? `¡Dominaste “${result.pattern.title}”!`
              : `${result.pattern.title}: ${result.pattern.correct_streak} de ${result.pattern.mastery_threshold} seguidos`}
          </p>
        )}

        <Button ref={buttonRef} size="lg" onClick={onContinue} className="mt-1 w-full sm:ml-auto sm:w-auto sm:min-w-44">
          {continueLabel}
        </Button>
      </div>
    </div>
  )
}
