import { Link } from 'react-router'
import { cn } from '@/lib/cn'

type Props = {
  total: number
  /** Resultados por posición: true acierto, false fallo, null sin responder */
  results: (boolean | null)[]
  current: number
  xp: number
  /** Examen: marca las respondidas sin revelar si fueron correctas */
  neutral?: boolean
}

/**
 * Barra superior del reproductor (capa funcional, Liquid Glass, ancho completo):
 * cerrar · progreso por ejercicio · XP de la sesión. El progreso se guarda solo, así que
 * cerrar no pierde nada.
 */
export function PlayerBar({ total, results, current, xp, neutral }: Props) {
  const answered = results.filter((r) => r !== null).length
  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-separator pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4 sm:px-6">
        <Link
          to="/lessons"
          aria-label="Salir de la lección (tu progreso se guarda)"
          title="Salir (tu progreso se guarda)"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 transition-[background-color,color,transform] duration-150 ease-out hover:bg-fill hover:text-label active:scale-[0.97]"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-[1.8]">
            <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
          </svg>
        </Link>

        <div
          role="progressbar"
          aria-label="Progreso de la lección"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          aria-valuetext={`${answered} de ${total} ejercicios`}
          className="grid flex-1 gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: total }, (_, i) => {
            const r = results[i]
            return (
              <span key={i} className="relative h-1.5 overflow-hidden rounded-full bg-fill">
                <span
                  className={cn(
                    'absolute inset-0 origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none',
                    neutral ? 'bg-accent' : r === true ? 'bg-success' : r === false ? 'bg-danger' : 'bg-accent',
                  )}
                  style={{ transform: `scaleX(${r !== null ? 1 : i === current ? 0.35 : 0})` }}
                />
              </span>
            )
          })}
        </div>

        <span className="shrink-0 text-callout font-semibold tabular-nums" aria-label={`${xp} XP en esta sesión`}>
          <span className="text-accent-text">+{xp}</span> <span className="text-label-2">XP</span>
        </span>
      </div>
    </header>
  )
}
