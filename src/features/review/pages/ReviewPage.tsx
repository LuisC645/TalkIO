import { Link } from 'react-router'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { GroupedList, Row } from '@/components/ui/GroupedList'
import { PageHeader } from '@/components/ui/PageHeader'
import { dayOfMonth, formatWeekdayNarrow } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { useReviewOverview } from '../api'

/**
 * Repaso (vista general): cuánto toca hoy, la previsión de los próximos 7 días y el estado del
 * mazo. Estilo iOS: número grande, listas agrupadas, sin tarjetas decorativas.
 */
export function ReviewPage() {
  const { data, isPending } = useReviewOverview()
  const today = data ? data.dueReviews + data.newToday : 0
  const maxForecast = Math.max(1, ...(data?.forecast.map((f) => f.count) ?? [1]))

  return (
    <div className="animate-stagger mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader title="Repaso" subtitle="Repetición espaciada: cada tarjeta vuelve justo antes de que la olvides." />

      {/* Hoy: número protagonista + acción */}
      <section className="flex flex-col gap-5 rounded-[22px] bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className={cn('transition-opacity duration-200', isPending && 'opacity-40')}>
          <p className="text-callout font-medium text-label-2">Para hoy</p>
          <p className="flex items-baseline gap-2">
            <span className="text-[3.5rem] leading-none font-bold tracking-[-0.035em]">{isPending ? '—' : today}</span>
            <span className="text-body font-medium text-label-2">{today === 1 ? 'tarjeta' : 'tarjetas'}</span>
          </p>
          {data && (
            <p className="mt-1 text-footnote text-label-2">
              {data.dueReviews} vencidas · {data.newToday} nuevas{' '}
              <span className="text-label-3">(máx. {data.newLimit} nuevas al día)</span>
            </p>
          )}
        </div>
        {today > 0 ? (
          <Link to="/review/session" className={buttonClasses('primary', 'lg', 'w-full sm:w-auto sm:min-w-48')}>
            Empezar repaso
          </Link>
        ) : (
          <p className="text-callout text-label-2">{isPending ? '' : 'Todo al día. Vuelve mañana.'}</p>
        )}
      </section>

      {/* Próximos 7 días: columnas finas en un solo tono (dataviz › magnitud = secuencial) */}
      <section className="flex flex-col gap-2">
        <h2 className="px-4 text-footnote font-medium text-label-2">Próximos 7 días</h2>
        <div className="relative rounded-[22px] bg-surface px-4 pt-5 pb-4 sm:px-6">
          {data && data.forecast.every((f) => f.count === 0) && (
            <p className="absolute inset-x-6 top-1/3 text-center text-callout text-label-2">
              Nada programado esta semana. Las tarjetas que repases aparecerán aquí.
            </p>
          )}
          <ol className="grid h-36 grid-cols-7 items-end gap-2 sm:gap-4" aria-label="Tarjetas que vencen cada día">
            {(data?.forecast ?? Array.from({ length: 7 }, () => null)).map((f, i) => (
              <li key={f?.date ?? i} className="flex h-full flex-col items-center justify-end gap-1.5" aria-label={f ? `${f.count} tarjetas` : undefined}>
                <span className="text-footnote font-semibold tabular-nums">{f?.count || ''}</span>
                <span
                  className="w-full max-w-6 rounded-t-[4px] bg-accent transition-[height] duration-500 ease-out motion-reduce:transition-none"
                  style={{ height: f?.count ? `${Math.max(6, (f.count / maxForecast) * 88)}px` : '2px', opacity: f?.count ? 1 : 0.25 }}
                />
                <span className="flex flex-col items-center text-[0.6875rem] leading-tight text-label-2">
                  <span>{f ? formatWeekdayNarrow(f.date) : ''}</span>
                  <span className="font-medium tabular-nums">{f ? dayOfMonth(f.date) : ''}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <GroupedList header="Tu mazo" footer="Consolidadas: tarjetas que ya recuerdas por semanas.">
        <Row label="Vocabulario" detail={data?.deck.vocab ?? '—'} />
        <Row label="Errores frecuentes" detail={data?.deck.patterns ?? '—'} />
        <Row label="Sin estudiar" detail={data?.newCards ?? '—'} />
        <Row label="Aprendiendo" detail={data?.deck.learning ?? '—'} />
        <Row label="En repaso" detail={data?.deck.young ?? '—'} />
        <Row label="Consolidadas" detail={data?.deck.mature ?? '—'} />
      </GroupedList>
    </div>
  )
}
