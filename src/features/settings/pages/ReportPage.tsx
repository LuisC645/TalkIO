import { Link, useParams } from 'react-router'
import { Spinner } from '@/components/ui/Spinner'
import { Markdown } from '@/lib/markdown'
import { useWeeklyReport, weekLabel } from '../reports'

type Stats = { totals?: { xp: number; days_active: number; lessons: number; reviews: number; active_minutes: number } }

/** Reporte semanal: cifras clave arriba y el texto (IA o plantilla con datos reales) debajo. */
export function ReportPage() {
  const { reportId = '' } = useParams()
  const { data, isPending, isError } = useWeeklyReport(reportId)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link to="/settings" className="flex min-h-11 w-fit items-center gap-1 text-callout font-medium text-link">
        <svg aria-hidden viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-2">
          <path d="m12.5 4.5-5.5 5.5 5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Ajustes
      </Link>
      {isPending ? (
        <div className="flex h-40 items-center justify-center text-label-2">
          <Spinner />
        </div>
      ) : isError || !data ? (
        <p className="text-callout text-danger">No se pudo cargar el reporte.</p>
      ) : (
        <>
          <header>
            <p className="text-callout font-medium text-label-2">Reporte semanal</p>
            <h1 className="font-display text-[2.125rem] leading-[1.12] font-bold tracking-[-0.03em]">{weekLabel(data.week_start, data.week_end)}</h1>
          </header>
          {(() => {
            const t = (data.stats as Stats).totals
            if (!t) return null
            return (
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-separator sm:grid-cols-4">
                {[
                  ['XP', t.xp],
                  ['Días activos', `${t.days_active}/7`],
                  ['Minutos', t.active_minutes],
                  ['Lecciones', t.lessons],
                ].map(([k, v]) => (
                  <div key={String(k)} className="bg-surface px-4 py-3">
                    <dt className="text-footnote text-label-2">{k}</dt>
                    <dd className="text-title-2 font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            )
          })()}
          <article className="rounded-[22px] bg-surface p-5 sm:p-7">
            <Markdown source={data.content_md} />
          </article>
          {data.model === 'plantilla' && (
            <p className="px-1 text-footnote text-label-2">Resumen generado con tus datos de la semana (sin IA).</p>
          )}
        </>
      )}
    </div>
  )
}
