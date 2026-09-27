import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Metric = {
  label: string
  icon: ReactNode
  value: ReactNode
  unit?: string
  footer?: ReactNode
}

/**
 * Resumen de métricas en UNA superficie, separadas por líneas finas (estilo Fitness/Health),
 * en lugar de cuatro tarjetas sueltas. Cifras proporcionales en sans semibold (dataviz › Figures).
 */
export function SummaryStrip({ metrics, loading }: { metrics: Metric[]; loading?: boolean }) {
  return (
    <section aria-label="Resumen" className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-separator lg:grid-cols-4">
      {metrics.map((m) => (
        <div key={m.label} className="flex flex-col gap-2.5 bg-surface p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-footnote font-medium text-label-2">
            <span aria-hidden className="flex size-[18px] items-center justify-center">
              {m.icon}
            </span>
            {m.label}
          </div>
          <p className={cn('flex items-baseline gap-1.5 transition-opacity duration-200', loading && 'opacity-40')}>
            <span className="text-[clamp(1.75rem,1.45rem+1vw,2.25rem)] leading-none font-semibold tracking-[-0.025em]">{loading ? '—' : m.value}</span>
            {m.unit && !loading && <span className="text-callout font-medium text-label-2">{m.unit}</span>}
          </p>
          {m.footer && <div className="mt-auto text-footnote text-label-2">{m.footer}</div>}
        </div>
      ))}
    </section>
  )
}
