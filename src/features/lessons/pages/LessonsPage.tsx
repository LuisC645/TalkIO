import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Card } from '@/components/ui/Card'
import { BookIcon } from '@/components/ui/icons'
import { Meter } from '@/components/ui/Meter'
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useErrorPatterns } from '@/features/progress/api'
import { cn } from '@/lib/cn'
import { useActiveLesson, useGenerateLesson, useLessonHistory, useLessonPatterns } from '../api'
import { ExamsSection } from '../components/ExamsSection'

const stagger = (n: number) => ({ '--stagger': n }) as CSSProperties

// Mientras la IA genera (~10 s): pasos honestos de lo que ocurre, sin barra falsa
const GENERATING_STEPS = ['Revisando tus errores activos', 'Eligiendo el tema', 'Escribiendo los ejercicios', 'Preparando tus tarjetas']

export function LessonsPage() {
  const active = useActiveLesson()
  const history = useLessonHistory()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <PageHeader
        title="Lecciones"
        subtitle="Cada lección se arma con tus errores activos, tu vocabulario pendiente y tus temas."
      />

      <section style={stagger(1)} className="animate-enter flex flex-col gap-3">
        <SectionHeader title="Hoy" />
        {active.isPending ? (
          <Card className="flex h-56 items-center justify-center text-label-2">
            <Spinner />
          </Card>
        ) : active.data ? (
          <ActiveLessonCard lesson={active.data} />
        ) : (
          <GenerateCard />
        )}
      </section>

      <div style={stagger(2)} className="animate-enter">
        <ExamsSection />
      </div>

      <section style={stagger(3)} className="animate-enter flex flex-col gap-3">
        <SectionHeader title="Historial" />
        <Card className="p-2 sm:p-3">
          {history.isPending ? (
            <p className="py-8 text-center text-callout text-label-2">Cargando…</p>
          ) : !history.data?.length ? (
            <p className="px-3 py-8 text-center text-callout text-label-2">Aquí aparecerán las lecciones que completes.</p>
          ) : (
            <ul>
              {history.data.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/lessons/${l.id}`}
                    className="flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-150 hover:bg-fill/60"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-label-2">
                      <BookIcon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-callout font-semibold">{l.title}</span>
                      <span className="block text-footnote text-label-2">
                        {l.completed_at ? new Date(l.completed_at).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : ''} · +{l.xp_earned} XP
                        {l.round > 1 ? ` · intento ${l.round}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-callout font-semibold tabular-nums">
                      {l.score ?? '—'}
                      <span className="text-footnote font-medium text-label-2">/100</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  )
}

function ActiveLessonCard({
  lesson,
}: {
  lesson: { id: string; title: string; status: string; focus_pattern_ids: string[]; total: number; done: number }
}) {
  const patterns = useLessonPatterns(lesson.focus_pattern_ids)
  const started = lesson.done > 0
  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-footnote font-medium text-label-2">{started ? 'En curso' : 'Lista para empezar'} · unos 20 minutos</p>
        <h2 className="font-display text-[clamp(1.5rem,1.25rem+1vw,2.125rem)] leading-[1.15] font-bold tracking-[-0.025em] text-balance">
          {lesson.title}
        </h2>
        {!!patterns.data?.length && (
          <div className="flex flex-wrap gap-2 pt-1">
            {patterns.data.map((p) => (
              <span key={p.id} className="rounded-full bg-accent/10 px-3 py-1 text-footnote font-semibold text-accent-text">
                {p.title}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Meter value={lesson.done} max={lesson.total} label="Avance de la lección" />
        <p className="text-footnote text-label-2">
          {lesson.done} de {lesson.total} ejercicios
        </p>
      </div>
      <Link to={`/lessons/${lesson.id}`} className={buttonClasses('primary', 'lg', 'w-full sm:w-fit sm:min-w-52')}>
        {started ? 'Continuar lección' : 'Empezar lección'}
      </Link>
    </Card>
  )
}

function GenerateCard() {
  const navigate = useNavigate()
  const generate = useGenerateLesson()
  const patterns = useErrorPatterns()
  const [step, setStep] = useState(0)
  const focus = (patterns.data?.active ?? []).slice(0, 3).map((p) => p.title)

  useEffect(() => {
    if (!generate.isPending) return
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, GENERATING_STEPS.length - 1)), 2600)
    return () => window.clearInterval(t)
  }, [generate.isPending])

  function onGenerate() {
    setStep(0)
    generate.mutate(undefined, { onSuccess: ({ lesson_id }) => navigate(`/lessons/${lesson_id}`) })
  }

  if (generate.isPending) {
    return (
      <Card className="flex flex-col gap-6 p-5 sm:p-8" aria-live="polite">
        <div className="flex items-center gap-3">
          <Spinner className="size-5 text-accent-text" />
          <p className="text-body font-semibold">Creando tu lección…</p>
        </div>
        <ol className="flex flex-col gap-3">
          {GENERATING_STEPS.map((label, i) => (
            <li
              key={label}
              className={cn(
                'flex items-center gap-3 text-callout transition-opacity duration-300',
                i <= step ? 'opacity-100' : 'opacity-35',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-footnote font-semibold transition-colors duration-300',
                  i < step ? 'bg-success text-white' : i === step ? 'bg-accent text-white' : 'bg-fill text-label-2',
                )}
              >
                {i < step ? '✓' : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <p className="text-footnote text-label-2">Suele tardar unos 10 segundos.</p>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-footnote font-medium text-label-2">Tu lección de hoy · unos 20 minutos</p>
        <h2 className="font-display text-[clamp(1.5rem,1.25rem+1vw,2.125rem)] leading-[1.15] font-bold tracking-[-0.025em]">
          Genera una lección a tu medida
        </h2>
        <p className="text-callout text-label-2">
          {focus.length ? `Se enfocará en: ${focus.join(' · ')}.` : 'Se armará con tu nivel y tus temas.'}
        </p>
      </div>
      {generate.isError && (
        <p role="alert" className="appear rounded-xl bg-danger/10 px-4 py-3 text-callout text-danger">
          {generate.error.message}
        </p>
      )}
      <Button size="lg" onClick={onGenerate} className="w-full sm:w-fit sm:min-w-52">
        {generate.isError ? 'Intentar de nuevo' : 'Generar lección'}
      </Button>
    </Card>
  )
}
