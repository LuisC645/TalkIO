import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

type Pattern = {
  id: string
  title: string
  rule: string
  skill: string
  priority: number
  correct_streak: number
  mastery_threshold: number
}

type Props = {
  active: Pattern[] | undefined
  masteredCount: number
  loading?: boolean
  limit?: number
}

const SKILL: Record<string, string> = { speaking: 'Al hablar', writing: 'Al escribir', both: 'Hablar y escribir' }

/**
 * Registro de errores: cada patrón sale con N aciertos seguidos (por defecto 3).
 * El avance se muestra como pasos discretos + texto "1 de 3" (nunca solo color).
 */
export function ErrorPatterns({ active, masteredCount, loading, limit = 5 }: Props) {
  const list = (active ?? []).slice(0, limit)
  const rest = (active?.length ?? 0) - list.length

  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-body font-semibold">Errores en los que estás trabajando</h2>
          <p className="text-footnote text-label-2">Cada uno sale del registro con 3 aciertos seguidos.</p>
        </div>
        {!loading && (
          <p className="text-footnote text-label-2">
            <span className="font-semibold text-label">{active?.length ?? 0}</span> activos ·{' '}
            <span className="font-semibold text-label">{masteredCount}</span> dominados
          </p>
        )}
      </div>

      <ul className={cn('mt-4 flex flex-col transition-opacity duration-200', loading && 'opacity-40')}>
        {loading && <li className="py-8 text-center text-callout text-label-2">Cargando…</li>}
        {!loading && list.length === 0 && (
          <li className="py-8 text-center text-callout text-label-2">No tienes errores activos. ¡Buen trabajo!</li>
        )}
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-4 border-t border-separator py-3.5 first:border-t-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2 sm:items-center">
                <p className="line-clamp-2 text-callout font-semibold sm:truncate">{p.title}</p>
                {p.priority >= 5 && (
                  <span className="shrink-0 rounded-full bg-fill px-2 py-0.5 text-[0.6875rem] font-semibold text-label-2">
                    Prioridad
                  </span>
                )}
              </div>
              <p className="truncate text-footnote text-label-2" title={p.rule}>
                {SKILL[p.skill] ?? ''} · {p.rule}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex gap-1" role="img" aria-label={`${p.correct_streak} de ${p.mastery_threshold} aciertos seguidos`}>
                {Array.from({ length: p.mastery_threshold }, (_, i) => (
                  <span
                    key={i}
                    className={cn('h-1.5 w-4 rounded-full', i < p.correct_streak ? 'bg-accent' : 'bg-accent/15 dark:bg-accent/30')}
                  />
                ))}
              </div>
              <span className="text-[0.6875rem] font-medium text-label-2 tabular-nums">
                {Math.min(p.correct_streak, p.mastery_threshold)} de {p.mastery_threshold}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {rest > 0 && <p className="mt-2 text-footnote text-label-2">Y {rest} más en tu registro.</p>}
    </Card>
  )
}
