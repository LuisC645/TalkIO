import { Card } from '@/components/ui/Card'
import { CheckIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { formatLong, formatWeekdayNarrow } from '@/lib/dates'
import type { WeeklyStats } from '../api'

type Props = { stats: WeeklyStats | undefined; today: string; loading?: boolean }

/**
 * Semana actual (lunes a domingo): una fila de 7 días donde la meta cumplida se marca con
 * un círculo relleno + check (forma, no solo color) y hoy con un anillo. Debajo, 3 cifras.
 */
export function WeekSummary({ stats, today, loading }: Props) {
  const days = stats?.daily ?? []
  const totals = stats?.totals
  const accuracy = stats?.attempts.accuracy
  const prev = stats?.previous_week_xp ?? 0
  const delta = (totals?.xp ?? 0) - prev

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div>
        <h2 className="text-body font-semibold">Esta semana</h2>
        <p className="text-footnote text-label-2">
          {loading || !totals
            ? 'Cargando…'
            : prev > 0
              ? `${delta >= 0 ? '+' : '−'}${Math.abs(delta)} XP frente a la semana pasada`
              : 'Tu primera semana en TalkIO'}
        </p>
      </div>

      <ol className={cn('grid grid-cols-7 gap-1 transition-opacity duration-200', loading && 'opacity-40')}>
        {(days.length ? days : Array.from({ length: 7 }, () => null)).map((d, i) => {
          const isToday = d?.local_date === today
          const future = d ? d.local_date > today : false
          const active = !!d && (d.xp > 0 || d.exercises_done > 0 || d.reviews_done > 0)
          return (
            <li
              key={d?.local_date ?? i}
              className="flex flex-col items-center gap-1.5"
              aria-label={d ? `${formatLong(d.local_date)}: ${d.goal_met ? 'meta cumplida' : active ? 'con actividad' : 'sin actividad'}` : undefined}
            >
              <span className={cn('text-[0.6875rem] font-medium', isToday ? 'text-label' : 'text-label-2')}>
                {d ? formatWeekdayNarrow(d.local_date) : ''}
              </span>
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full',
                  d?.goal_met ? 'bg-accent text-white' : active ? 'bg-accent/20' : future ? 'bg-fill/50' : 'bg-fill',
                  isToday && 'ring-[1.5px] ring-label ring-offset-2 ring-offset-surface',
                )}
              >
                {d?.goal_met && <CheckIcon className="size-3.5" />}
              </span>
            </li>
          )
        })}
      </ol>

      <dl className="grid grid-cols-3 gap-3 border-t border-separator pt-4">
        {[
          { label: 'XP', value: totals ? totals.xp.toLocaleString('es') : '—' },
          { label: 'Días activos', value: totals ? `${totals.days_active}/7` : '—' },
          { label: 'Precisión', value: accuracy != null ? `${Math.round(accuracy * 100)}%` : '—' },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <dt className="text-footnote text-label-2">{item.label}</dt>
            <dd className="text-title-2 font-semibold">{loading ? '—' : item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
