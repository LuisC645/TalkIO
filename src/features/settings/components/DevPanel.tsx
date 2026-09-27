import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { invokeFunction } from '@/lib/functions'


type Action =
  | { action: 'add_xp'; amount: number }
  | { action: 'simulate_streak'; days: number }
  | { action: 'make_cards_due'; count: number }
  | { action: 'discard_active_lesson' }
  | { action: 'reset_progress' }
  | { action: 'reset_reviews' }
  | { action: 'reset_patterns' }
  | { action: 'unlock_exams' }
  | { action: 'generate_report' }
  | { action: 'test_weekly_report' }
  | { action: 'test_streak_email' }

type Stats = {
  ai_calls_24h: number
  ai_failures_24h: number
  tokens_in_24h: number
  tokens_out_24h: number
  cards_new: number
  cards_studied: number
  lessons_completed: number
  lessons_active: number
}

const GROUPS: { title: string; items: { label: string; detail: string; body: Action; destructive?: boolean }[] }[] = [
  {
    title: 'Progreso',
    items: [
      { label: '+10 XP', detail: 'Suma XP de ajuste', body: { action: 'add_xp', amount: 10 } },
      { label: '+50 XP', detail: 'Cumple la meta de hoy', body: { action: 'add_xp', amount: 50 } },
      { label: 'Racha de 7 días', detail: 'Completa la meta de los 7 días anteriores', body: { action: 'simulate_streak', days: 7 } },
    ],
  },
  {
    title: 'Lecciones y repaso',
    items: [
      { label: 'Descartar lección activa', detail: 'Para generar una nueva', body: { action: 'discard_active_lesson' } },
      { label: 'Vencer 10 tarjetas', detail: 'Adelanta tarjetas ya estudiadas', body: { action: 'make_cards_due', count: 10 } },
      { label: 'Desbloquear examen', detail: 'El próximo examen (semanal o de nivel) sin requisitos', body: { action: 'unlock_exams' } },
    ],
  },
  {
    title: 'Reportes y correos',
    items: [
      { label: 'Generar reporte en la app', detail: 'Con tu actividad de esta semana; aparece en Reportes semanales', body: { action: 'generate_report' } },
      { label: 'Enviar reporte por correo', detail: 'Igual, pero a tu email (sin guardarlo en la app)', body: { action: 'test_weekly_report' } },
      { label: 'Enviar recordatorio de racha', detail: 'El correo de las 19:00 con tu racha y tu meta de hoy', body: { action: 'test_streak_email' } },
    ],
  },
  {
    title: 'Reiniciar',
    items: [
      { label: 'XP, nivel y racha', detail: 'Borra la actividad', body: { action: 'reset_progress' }, destructive: true },
      { label: 'Todas las tarjetas', detail: 'Vuelven a "sin estudiar"', body: { action: 'reset_reviews' }, destructive: true },
      { label: 'Errores dominados', detail: 'Vuelven a activos', body: { action: 'reset_patterns' }, destructive: true },
    ],
  },
]

/**
 * Panel de pruebas en Ajustes (solo con VITE_DEV_TOOLS=true y el secreto DEV_TOOLS_ENABLED).
 * Las acciones destructivas piden confirmación en dos pasos.
 */
export function DevPanel() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const confirmTimer = useRef<number>(0)

  const stats = useQuery({
    queryKey: ['dev', 'stats'],
    queryFn: () => invokeFunction<{ stats: Stats }>('dev-tools', { action: 'stats' }).then((r) => r.stats),
  })

  const run = useMutation({
    mutationFn: (body: Action) => invokeFunction<{ message: string }>('dev-tools', body),
    onSuccess: (r) => {
      setMessage({ text: r.message })
      queryClient.invalidateQueries()
    },
    onError: (e) => setMessage({ text: e.message, error: true }),
  })

  useEffect(() => () => window.clearTimeout(confirmTimer.current), [])

  function onPress(label: string, body: Action, destructive?: boolean) {
    if (destructive && confirming !== label) {
      setConfirming(label)
      window.clearTimeout(confirmTimer.current)
      confirmTimer.current = window.setTimeout(() => setConfirming(null), 3500)
      return
    }
    setConfirming(null)
    run.mutate(body)
  }

  const s = stats.data
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 px-4">
        <h2 className="text-footnote font-medium text-label-2">Pruebas · solo afecta a tu cuenta</h2>
        {run.isPending && <Spinner className="size-4 text-label-2" />}
      </div>

      {message && (
        <p role="status" className={cn('appear rounded-2xl px-4 py-3 text-footnote font-medium', message.error ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success')}>
          {message.text}
        </p>
      )}

      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h3 className="px-4 text-footnote font-medium text-label-2">{group.title}</h3>
          <ul className="overflow-hidden rounded-[22px] bg-surface">
            {group.items.map((item) => {
              const armed = confirming === item.label
              return (
                <li key={item.label} className="group/row relative">
                  <button
                    type="button"
                    disabled={run.isPending}
                    onClick={() => onPress(item.label, item.body, item.destructive)}
                    className={cn(
                      'flex min-h-14 w-full flex-col items-start justify-center px-4 py-2 text-left transition-colors duration-150 hover:bg-fill/50 disabled:opacity-50',
                      armed && 'bg-danger/10',
                    )}
                  >
                    <span className={cn('text-callout font-medium', item.destructive ? 'text-danger' : 'text-accent-text')}>
                      {armed ? `Toca de nuevo para confirmar` : item.label}
                    </span>
                    <span className="text-footnote text-label-2">{armed ? item.label : item.detail}</span>
                  </button>
                  <span aria-hidden className="absolute right-0 bottom-0 left-4 h-px bg-separator group-last/row:hidden" />
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h3 className="px-4 text-footnote font-medium text-label-2">Estado (últimas 24 h)</h3>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-separator">
          {[
            ['Llamadas IA', s ? `${s.ai_calls_24h}${s.ai_failures_24h ? ` (${s.ai_failures_24h} fallos)` : ''}` : '—'],
            ['Tokens', s ? `${(s.tokens_in_24h / 1000).toFixed(1)}k / ${(s.tokens_out_24h / 1000).toFixed(1)}k` : '—'],
            ['Tarjetas nuevas', s?.cards_new ?? '—'],
            ['Tarjetas estudiadas', s?.cards_studied ?? '—'],
            ['Lecciones hechas', s?.lessons_completed ?? '—'],
            ['Lección activa', s ? (s.lessons_active ? 'Sí' : 'No') : '—'],
          ].map(([k, v]) => (
            <div key={String(k)} className="bg-surface px-4 py-3">
              <dt className="text-footnote text-label-2">{k}</dt>
              <dd className="text-callout font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {stats.isError && <p className="px-4 text-footnote text-danger">{stats.error.message}</p>}
      </section>
    </div>
  )
}
