import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { CheckIcon } from '@/components/ui/icons'
import { ResultIcon } from '@/features/exercises/shared'
import { cn } from '@/lib/cn'
import type { Attempt, Exercise, LessonKind } from '../types'

const stagger = (n: number) => ({ '--stagger': n }) as CSSProperties

export function ExamIntroStage({
  kind,
  title,
  covers,
  summary,
  count,
  threshold,
  targetLevel,
  resuming,
  onStart,
}: {
  kind: LessonKind
  title: string
  covers: string | null
  summary: string | null
  count: number
  threshold: number
  targetLevel: string | null
  resuming: boolean
  onStart: () => void
}) {
  const rules = [
    `${count} preguntas${kind === 'level_exam' ? ', con un texto final' : ''}`,
    'Sin pistas ni correcciones durante el examen',
    'Verás tus resultados y las respuestas correctas al final',
    kind === 'level_exam'
      ? `Con ${threshold}% o más subes a ${targetLevel ?? 'el siguiente nivel'}`
      : `Aprobado con ${threshold}% o más`,
  ]
  return (
    <div className="flex flex-col gap-8">
      <div style={stagger(0)} className="animate-enter flex flex-col gap-3">
        <p className="text-callout font-medium text-label-2">{kind === 'level_exam' ? 'Examen de nivel' : 'Examen semanal'}</p>
        <h1 className="font-display text-[clamp(2rem,1.5rem+2vw,3rem)] leading-[1.08] font-bold tracking-[-0.03em] text-balance">{title}</h1>
        {(covers || summary) && <p className="text-body text-label-2">{summary ?? covers}</p>}
      </div>
      <ul style={stagger(1)} className="animate-enter overflow-hidden rounded-[22px] bg-surface">
        {rules.map((r) => (
          <li key={r} className="group/row relative flex min-h-12 items-center gap-3 px-4 py-3">
            <CheckIcon className="size-4 shrink-0 text-label-2" />
            <span className="text-body">{r}</span>
            <span aria-hidden className="absolute right-0 bottom-0 left-11 h-px bg-separator group-last/row:hidden" />
          </li>
        ))}
      </ul>
      <Button style={stagger(2)} size="lg" onClick={onStart} className="animate-enter w-full sm:w-auto sm:min-w-52">
        {resuming ? 'Continuar examen' : 'Empezar examen'}
      </Button>
    </div>
  )
}

function answerText(ex: Exercise, a: Attempt | undefined): string {
  if (!a) return '—'
  const r = a.response
  if ('text' in r) return r.text
  if ('tokens' in r) return r.tokens.join(' ')
  const options = (ex.payload.options as string[]) ?? []
  return options[r.choice] ?? '—'
}

export function ExamCompletionStage({
  kind,
  score,
  threshold,
  passed,
  fromLevel,
  newLevel,
  targetLevel,
  xp,
  exercises,
  attempts,
}: {
  kind: LessonKind
  score: number
  threshold: number
  passed: boolean
  fromLevel: string | null
  newLevel: string | null
  targetLevel: string | null
  xp: number
  exercises: Exercise[]
  attempts: Map<string, Attempt>
}) {
  const correct = exercises.filter((e) => attempts.get(e.id)?.is_correct).length
  const headline =
    kind === 'level_exam'
      ? passed
        ? `¡Subiste a ${newLevel ?? targetLevel}!`
        : newLevel
          ? `Avanzaste a ${newLevel}`
          : 'Aún no, pero estás cerca'
      : passed
        ? '¡Examen aprobado!'
        : 'Examen completado'
  const detail =
    kind === 'level_exam'
      ? passed
        ? `Tu nivel pasó de ${fromLevel ?? '—'} a ${newLevel ?? targetLevel}.`
        : newLevel
          ? `Necesitas ${threshold}% para ${targetLevel}. Tu nivel ahora es ${newLevel}: ya estás en camino.`
          : `Necesitas ${threshold}% para subir a ${targetLevel}. Podrás intentarlo de nuevo en 3 días; sigue con tus lecciones.`
      : passed
        ? 'Dominaste lo que practicaste esta semana.'
        : `El aprobado es ${threshold}%. Repasa las respuestas de abajo: tus errores ya están en tu registro.`

  return (
    <div className="flex flex-col gap-8">
      <div style={stagger(0)} className="animate-enter flex flex-col items-center gap-4 text-center">
        <span
          className={cn(
            'flex size-20 items-center justify-center rounded-full text-white',
            passed ? 'bg-success' : newLevel ? 'bg-accent' : 'bg-label-3',
          )}
        >
          <ResultIcon correct={passed || !!newLevel} className="size-10" />
        </span>
        <h1 className="font-display text-[clamp(2rem,1.5rem+2vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em] text-balance">{headline}</h1>
        <p className="max-w-md text-body text-label-2">{detail}</p>
      </div>

      <dl style={stagger(1)} className="animate-enter grid grid-cols-3 divide-x divide-separator rounded-[22px] bg-surface py-4">
        {[
          { label: 'Nota', value: `${score}`, unit: '/100' },
          { label: 'Aciertos', value: `${correct}`, unit: `/${exercises.length}` },
          { label: 'XP', value: `+${xp}`, unit: '' },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-0.5 px-2">
            <dt className="text-footnote text-label-2">{s.label}</dt>
            <dd className="text-title-1 font-semibold">
              {s.value}
              <span className="text-callout font-medium text-label-2">{s.unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <section style={stagger(2)} className="animate-enter flex flex-col gap-2">
        <h2 className="px-4 text-footnote font-medium text-label-2">Revisión</h2>
        <ol className="overflow-hidden rounded-[22px] bg-surface">
          {exercises.map((ex, i) => {
            const a = attempts.get(ex.id)
            const ok = !!a?.is_correct
            const sentence = (ex.payload.sentence ?? ex.payload.prompt) as string | undefined
            return (
              <li key={ex.id} className="group/row relative flex gap-3 px-4 py-3.5">
                <span
                  className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white', ok ? 'bg-success' : 'bg-danger')}
                  aria-label={ok ? 'Correcta' : 'Incorrecta'}
                >
                  <ResultIcon correct={ok} className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-footnote text-label-2">
                    {i + 1}. {String(ex.payload.instruction ?? '')}
                  </p>
                  {sentence && (
                    <p className="text-callout font-medium" lang="en">
                      {sentence}
                    </p>
                  )}
                  <p className="mt-1 text-callout" lang="en">
                    <span className="text-label-2">Tu respuesta: </span>
                    <span className={ok ? 'text-label' : 'text-danger'}>{answerText(ex, a)}</span>
                  </p>
                  {!ok && a?.feedback.corrected && ex.type !== 'free_writing' && (
                    <p className="text-callout" lang="en">
                      <span className="text-label-2">Correcta: </span>
                      <span className="font-semibold text-success">{a.feedback.corrected}</span>
                    </p>
                  )}
                  {a?.feedback.explanation && <p className="mt-1 text-footnote text-label-2">{a.feedback.explanation}</p>}
                </div>
                <span aria-hidden className="absolute right-0 bottom-0 left-13 h-px bg-separator group-last/row:hidden" />
              </li>
            )
          })}
        </ol>
      </section>

      <div style={stagger(3)} className="animate-enter flex flex-col gap-2.5 sm:flex-row">
        <Link to="/lessons" className={buttonClasses('primary', 'lg', 'w-full sm:w-auto sm:min-w-44')}>
          Volver a lecciones
        </Link>
        <Link to="/dashboard" className={buttonClasses('secondary', 'lg', 'w-full sm:w-auto sm:min-w-44')}>
          Ver mi progreso
        </Link>
      </div>
    </div>
  )
}
