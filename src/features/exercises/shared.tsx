import { useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import type { Attempt, ExerciseResponse, Phase } from '@/features/lessons/types'

/** Props comunes de todas las tarjetas de ejercicio */
export type CardProps<P> = {
  payload: P
  /** Respuesta en edición (null = incompleta → "Comprobar" deshabilitado) */
  value: ExerciseResponse | null
  onChange: (value: ExerciseResponse | null) => void
  /** Intento ya calificado: la tarjeta se bloquea y muestra el resultado */
  attempt: Attempt | null
  /** Enviar con Enter desde un campo */
  onSubmit: () => void
}

const PHASE: Record<Phase, string> = { warmup: 'Calentamiento', drill: 'Práctica', free: 'Escritura libre' }

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Elige la opción',
  fill_blank: 'Completa',
  tense_contrast: 'Tiempo verbal',
  reorder: 'Ordena',
  transform: 'Transforma',
  error_detection: 'Corrige el error',
  free_writing: 'Escribe',
  speaking_prompt: 'Responde',
}

/** Envoltorio común: fase, tipo, texto de lectura opcional, instrucción y pista opcional */
export function ExerciseShell({
  phase,
  type,
  instruction,
  hint,
  passage,
  children,
}: {
  phase: Phase
  type: string
  instruction: string
  hint: string | null
  passage?: string | null
  children: ReactNode
}) {
  const [showHint, setShowHint] = useState(false)
  return (
    <Card className="flex flex-col gap-6 p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-2 text-footnote font-medium text-label-2">
        <span className="rounded-full bg-fill px-2.5 py-1 text-label">{passage ? 'Lectura' : (PHASE[phase] ?? phase)}</span>
        <span>{passage ? 'Comprensión' : (TYPE_LABEL[type] ?? 'Ejercicio')}</span>
      </div>
      {passage && (
        <div lang="en" className="flex max-h-[45dvh] flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl bg-fill/60 px-4 py-4 sm:px-5">
          {passage.split(/\n+/).map((p, i) => (
            <p key={i} className="text-body leading-[1.65] text-label">
              {p}
            </p>
          ))}
        </div>
      )}
      <h2 className="font-display text-[clamp(1.25rem,1.1rem+0.6vw,1.5rem)] leading-[1.3] font-semibold tracking-[-0.015em] text-balance">
        {instruction}
      </h2>
      {children}
      {hint && (
        <div className="-mt-2">
          {showHint ? (
            <p className="appear rounded-xl bg-fill px-4 py-3 text-callout text-label-2">
              <span className="font-semibold text-label">Pista: </span>
              {hint}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setShowHint(true)}
              className="min-h-9 rounded-full px-1 text-footnote font-medium text-link hover:underline"
            >
              Ver pista
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

export function ResultIcon({ correct, className }: { correct: boolean; className?: string }) {
  return correct ? (
    <svg aria-hidden viewBox="0 0 20 20" className={cn('fill-none stroke-current stroke-[2.2]', className)}>
      <path d="m4.5 10.5 3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden viewBox="0 0 20 20" className={cn('fill-none stroke-current stroke-[2.2]', className)}>
      <path d="m5.5 5.5 9 9m0-9-9 9" strokeLinecap="round" />
    </svg>
  )
}
