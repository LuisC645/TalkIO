import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Card } from '@/components/ui/Card'
import { CheckIcon } from '@/components/ui/icons'
import type { Exercise, LessonRule, LessonVocab } from '../types'

const stagger = (n: number) => ({ '--stagger': n }) as CSSProperties

const PHASES = [
  { key: 'warmup', label: 'Calentamiento', detail: 'Repaso rápido de lo que ya viste' },
  { key: 'rule', label: 'La regla', detail: 'Una explicación corta y vocabulario nuevo' },
  { key: 'drill', label: 'Práctica', detail: 'Ejercicios sobre tus errores activos' },
  { key: 'reading', label: 'Lectura', detail: 'Un texto corto con preguntas de comprensión' },
  { key: 'free', label: 'Escritura libre', detail: 'Tu respuesta, corregida por IA' },
]

export function IntroStage({
  title,
  focus,
  exercises,
  resuming,
  onStart,
}: {
  title: string
  focus: string[]
  exercises: Exercise[]
  resuming: boolean
  onStart: () => void
}) {
  const isReading = (e: Exercise) => !!e.payload.passage
  const count = (phase: string) =>
    phase === 'reading' ? exercises.filter(isReading).length : exercises.filter((e) => e.phase === phase && !isReading(e)).length
  return (
    <div className="flex flex-col gap-8">
      <div style={stagger(0)} className="animate-enter flex flex-col gap-3">
        <p className="text-callout font-medium text-label-2">Lección de hoy · unos 20 minutos</p>
        <h1 className="font-display text-[clamp(2rem,1.5rem+2vw,3rem)] leading-[1.08] font-bold tracking-[-0.03em] text-balance">{title}</h1>
        {focus.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {focus.map((f) => (
              <span key={f} className="rounded-full bg-accent/10 px-3 py-1 text-footnote font-semibold text-accent-text">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      <Card style={stagger(1)} className="animate-enter p-5 sm:p-7">
        <ol className="flex flex-col">
          {PHASES.map((p, i) => {
            const n = p.key === 'rule' ? null : count(p.key)
            if (n === 0) return null
            return (
              <li key={p.key} className="flex items-center gap-4 border-t border-separator py-3.5 first:border-t-0 first:pt-0 last:pb-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-footnote font-semibold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-callout font-semibold">{p.label}</p>
                  <p className="text-footnote text-label-2">{p.detail}</p>
                </div>
                {n != null && (
                  <span className="shrink-0 text-footnote text-label-2 tabular-nums">
                    {n} {n === 1 ? 'ejercicio' : 'ejercicios'}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </Card>

      <div style={stagger(2)} className="animate-enter">
        <Button size="lg" onClick={onStart} className="w-full sm:w-auto sm:min-w-52">
          {resuming ? 'Continuar lección' : 'Empezar'}
        </Button>
      </div>
    </div>
  )
}

export function RuleStage({ rule, vocabulary, onContinue }: { rule: LessonRule; vocabulary: LessonVocab[]; onContinue: () => void }) {
  return (
    <div className="animate-card flex flex-col gap-6">
      <Card className="flex flex-col gap-6 p-5 sm:p-8">
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full bg-fill px-2.5 py-1 text-footnote font-medium text-label">La regla</span>
          <h2 className="font-display text-[clamp(1.5rem,1.3rem+0.8vw,2rem)] leading-[1.2] font-bold tracking-[-0.02em] text-balance">{rule.title}</h2>
        </div>
        <p className="text-body leading-[1.6] text-label">{rule.explanation}</p>
        <ul className="flex flex-col gap-3">
          {rule.examples.map((ex, i) => (
            <li key={i} className="rounded-2xl bg-fill/60 px-4 py-3.5" lang="en">
              <p className="text-callout text-label-2 line-through decoration-danger decoration-2">{ex.wrong}</p>
              <p className="mt-1 flex items-start gap-2 text-body font-semibold">
                <CheckIcon className="mt-1 size-4 shrink-0 text-success" />
                {ex.right}
              </p>
              {ex.note && (
                <p className="mt-1 pl-6 text-footnote text-label-2" lang="es">
                  {ex.note}
                </p>
              )}
            </li>
          ))}
        </ul>
        {vocabulary.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-separator pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-callout font-semibold">Vocabulario nuevo</h3>
              <span className="text-footnote text-label-2">Pasa a tu repaso</span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {vocabulary.map((v) => (
                <li key={v.term} className="rounded-2xl bg-fill/60 px-4 py-3">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-body">
                    <span lang="en" className="font-semibold">
                      {v.term}
                    </span>
                    <span className="text-callout text-label-2">{v.translation}</span>
                  </p>
                  {v.example && (
                    <p lang="en" className="mt-1 text-footnote text-label-2 italic">
                      {v.example}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Button size="lg" onClick={onContinue} className="w-full sm:ml-auto sm:w-auto sm:min-w-52">
        Entendido, a practicar
      </Button>
    </div>
  )
}

export function CompletionStage({
  score,
  xp,
  correct,
  total,
  patterns,
  round,
  onRetake,
  retaking,
}: {
  score: number
  xp: number
  correct: number
  total: number
  patterns: { title: string; streak: number; threshold: number; mastered: boolean }[]
  round: number
  onRetake: () => void
  retaking: boolean
}) {
  const message = score >= 85 ? '¡Excelente sesión!' : score >= 60 ? '¡Buen trabajo!' : 'Lección completada'
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div style={stagger(0)} className="animate-enter flex flex-col items-center gap-4">
        <span className="flex size-20 items-center justify-center rounded-full bg-success text-white shadow-[0_12px_32px_-8px_color-mix(in_srgb,var(--success)_60%,transparent)]">
          <CheckIcon className="size-10" />
        </span>
        <h1 className="font-display text-[clamp(2rem,1.5rem+2vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em]">{message}</h1>
        <p className="max-w-md text-body text-label-2">
          {round > 1 ? `Intento ${round}: esta es ahora la nota guardada de la lección.` : 'Tus aciertos y errores ya actualizaron tu registro y tus repasos.'}
        </p>
      </div>

      <dl style={stagger(1)} className="animate-enter grid w-full grid-cols-3 gap-3">
        {[
          { label: 'Nota', value: `${score}`, unit: '/100' },
          { label: 'Aciertos', value: `${correct}`, unit: `/${total}` },
          { label: 'XP ganados', value: `+${xp}`, unit: '' },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col gap-1 p-4 sm:p-5">
            <dt className="text-footnote text-label-2">{s.label}</dt>
            <dd className="text-[clamp(1.5rem,1.2rem+1vw,2rem)] font-semibold tracking-[-0.02em]">
              {s.value}
              <span className="text-callout font-medium text-label-2">{s.unit}</span>
            </dd>
          </Card>
        ))}
      </dl>

      {patterns.length > 0 && (
        <Card style={stagger(2)} className="animate-enter w-full p-5 text-left sm:p-6">
          <p className="mb-3 text-callout font-semibold">Tus errores trabajados hoy</p>
          <ul className="flex flex-col gap-3">
            {patterns.map((p) => (
              <li key={p.title} className="flex items-center justify-between gap-4">
                <span className="text-callout">{p.title}</span>
                <span className="flex items-center gap-2">
                  <span className="flex gap-1" aria-hidden>
                    {Array.from({ length: p.threshold }, (_, i) => (
                      <span key={i} className={`h-1.5 w-4 rounded-full ${i < p.streak ? 'bg-accent' : 'bg-accent/15 dark:bg-accent/30'}`} />
                    ))}
                  </span>
                  <span className="w-20 text-right text-footnote text-label-2">{p.mastered ? 'Dominado' : `${p.streak} de ${p.threshold}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div style={stagger(3)} className="animate-enter flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
        <Link to="/dashboard" className={buttonClasses('primary', 'lg', 'w-full sm:w-auto sm:min-w-44')}>
          Ver mi progreso
        </Link>
        <Button variant="secondary" size="lg" onClick={onRetake} loading={retaking} className="w-full sm:w-auto sm:min-w-44">
          Repetir lección
        </Button>
      </div>
      <p className="-mt-4 max-w-sm text-center text-footnote text-label-2">
        Al repetir se guarda tu última nota. Los aciertos repetidos no cuentan para dominar un error.
      </p>
    </div>
  )
}
