import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Meter } from '@/components/ui/Meter'
import { SectionHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useCreateExam, useExamStatus, type ExamStatus, type ExamSummary } from '../api'

/**
 * Exámenes: semanal (sobre lo practicado en la semana) y de nivel (para subir de nivel MCER).
 * Cada uno muestra su estado: disponible, en curso, completado (nota) o bloqueado (qué falta).
 */
export function ExamsSection() {
  const status = useExamStatus()
  const create = useCreateExam()
  const navigate = useNavigate()

  function start(kind: 'weekly' | 'level') {
    create.mutate(kind, { onSuccess: ({ lesson_id }) => navigate(`/lessons/${lesson_id}`) })
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Exámenes" />
      {status.isPending ? (
        <div className="flex h-32 items-center justify-center rounded-[22px] bg-surface text-label-2">
          <Spinner />
        </div>
      ) : status.isError ? (
        <p className="rounded-[22px] bg-surface px-5 py-6 text-callout text-danger">{status.error.message}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <WeeklyExam s={status.data} onStart={() => start('weekly')} creating={create.isPending && create.variables === 'weekly'} />
          <LevelExam s={status.data} onStart={() => start('level')} creating={create.isPending && create.variables === 'level'} />
        </div>
      )}
      {create.isPending && <p className="px-1 text-footnote text-label-2">Preparando tu examen… suele tardar unos 15 segundos.</p>}
      {create.isError && <p className="px-1 text-footnote text-danger">{create.error.message}</p>}
    </section>
  )
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[22px] bg-surface p-5 sm:p-6">
      <div>
        <p className="text-footnote font-medium text-label-2">{eyebrow}</p>
        <h3 className="mt-0.5 font-display text-title-2 font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function ScoreBadge({ exam }: { exam: ExamSummary }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-footnote font-semibold',
        exam.passed ? 'bg-success/12 text-success' : 'bg-fill text-label-2',
      )}
    >
      {exam.score}/100 · {exam.passed ? 'Aprobado' : 'No aprobado'}
    </span>
  )
}

function WeeklyExam({ s, onStart, creating }: { s: ExamStatus; onStart: () => void; creating: boolean }) {
  const w = s.weekly
  const exam = w.exam
  return (
    <Panel eyebrow="Esta semana" title="Examen semanal">
      {exam?.status === 'completed' ? (
        <>
          <div className="flex items-center gap-2">
            <ScoreBadge exam={exam} />
          </div>
          <p className="text-callout text-label-2">El próximo examen semanal se desbloquea el lunes.</p>
          <Link to={`/lessons/${exam.id}`} className={buttonClasses('secondary', 'md', 'w-full sm:w-fit')}>
            Ver resultados
          </Link>
        </>
      ) : exam ? (
        <Link to={`/lessons/${exam.id}`} className={buttonClasses('primary', 'md', 'w-full sm:w-fit')}>
          Continuar examen
        </Link>
      ) : w.available ? (
        <>
          <p className="text-callout text-label-2">10 preguntas sobre lo que practicaste esta semana. Aprobado con 70%.</p>
          <Button onClick={onStart} loading={creating} className="w-full sm:w-fit">
            Empezar examen
          </Button>
        </>
      ) : (
        <>
          <p className="text-callout text-label-2">
            Completa {w.required} lecciones esta semana para desbloquearlo.
          </p>
          <div className="flex items-center gap-3">
            <Meter value={w.lessons_this_week} max={w.required} label="Lecciones de esta semana" className="flex-1" />
            <span className="text-footnote text-label-2 tabular-nums">
              {Math.min(w.lessons_this_week, w.required)}/{w.required}
            </span>
          </div>
        </>
      )}
    </Panel>
  )
}

function LevelExam({ s, onStart, creating }: { s: ExamStatus; onStart: () => void; creating: boolean }) {
  const l = s.level
  if (!l.target) {
    return (
      <Panel eyebrow={`Tu nivel: ${l.current}`} title="Nivel máximo">
        <p className="text-callout text-label-2">Ya estás en el nivel más alto del marco europeo.</p>
      </Panel>
    )
  }
  const cooldown = l.cooldown_until ? new Date(l.cooldown_until) : null
  return (
    <Panel eyebrow={`Tu nivel: ${l.current}`} title={`Examen para subir a ${l.target}`}>
      {l.exam ? (
        <Link to={`/lessons/${l.exam.id}`} className={buttonClasses('primary', 'md', 'w-full sm:w-fit')}>
          Continuar examen
        </Link>
      ) : l.available ? (
        <>
          <p className="text-callout text-label-2">
            13 preguntas de nivel {l.target} y un texto final. Con {l.pass_threshold}% o más subes de nivel.
          </p>
          <Button onClick={onStart} loading={creating} className="w-full sm:w-fit">
            Empezar examen de nivel
          </Button>
        </>
      ) : cooldown ? (
        <p className="text-callout text-label-2">
          Podrás intentarlo de nuevo el {cooldown.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })}.
          {l.last?.score != null && ` Tu último intento: ${l.last.score}/100.`}
        </p>
      ) : (
        <>
          <p className="text-callout text-label-2">
            Se desbloquea con {l.required} lecciones desde tu última evaluación y un promedio de {l.min_average} o más.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Meter value={l.lessons_since} max={l.required} label="Lecciones completadas desde tu última evaluación" className="flex-1" />
              <span className="w-24 text-right text-footnote text-label-2 tabular-nums">
                {Math.min(l.lessons_since, l.required)}/{l.required} lecciones
              </span>
            </div>
            <p className="text-footnote text-label-2">
              Promedio actual: <span className={cn('font-semibold', l.average >= l.min_average ? 'text-success' : 'text-label')}>{l.lessons_since ? l.average : '—'}</span>
            </p>
          </div>
        </>
      )}
      {l.last?.status === 'completed' && !cooldown && (
        <p className="text-footnote text-label-2">
          Último examen de nivel: {l.last.score}/100{l.last.new_level ? ` · subiste a ${l.last.new_level}` : ''}.
        </p>
      )}
    </Panel>
  )
}
