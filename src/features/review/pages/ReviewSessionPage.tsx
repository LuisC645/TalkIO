import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'
import { CheckIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { formatWhen, Rating, scheduler, toCard, toRecordPayload, type Grade, type SrsRow } from '@/lib/srs'
import { useRecordReview, useReviewQueue, type ReviewItem } from '../api'
import { Flashcard } from '../components/Flashcard'
import { playSound } from '@/lib/sound'

// Solo "Otra vez" repite la tarjeta en esta sesión, y como máximo 2 veces (así la sesión siempre
// termina). Con las demás respuestas queda guardada y vuelve cuando le toque.
const MAX_REPEATS = 2

const GRADES: { grade: Grade; label: string; hint: string; key: string; tone: string }[] = [
  { grade: Rating.Again, label: 'Otra vez', hint: 'No la recordé', key: '1', tone: 'text-danger' },
  { grade: Rating.Hard, label: 'Difícil', hint: 'Con esfuerzo', key: '2', tone: 'text-label' },
  { grade: Rating.Good, label: 'Bien', hint: 'La recordé', key: '3', tone: 'text-accent-text' },
  { grade: Rating.Easy, label: 'Fácil', hint: 'Sin dudar', key: '4', tone: 'text-success' },
]

/**
 * Sesión de repaso (pantalla completa). La cola la maneja el cliente: FSRS (ts-fsrs) calcula
 * el nuevo estado y la RPC record_review lo guarda de forma atómica (carta + log + XP).
 */
export function ReviewSessionPage() {
  const { data: initial, isPending, isError } = useReviewQueue()
  const record = useRecordReview()
  // La cola arranca con los datos del servidor y desde ahí la maneja la sesión
  const [sessionQueue, setQueue] = useState<ReviewItem[] | null>(null)
  const queue = sessionQueue ?? initial ?? null
  const [revealed, setRevealed] = useState(false)
  const [stats, setStats] = useState({ reviewed: 0, again: 0, uniques: new Set<string>() })
  const repeats = useRef(new Map<string, number>())
  const shownAt = useRef(0)

  useEffect(() => {
    if (initial) shownAt.current = Date.now()
  }, [initial])

  const current = queue?.[0]
  const previews = useMemo(() => {
    if (!current) return null
    const now = new Date()
    const preview = scheduler.repeat(toCard(current), now)
    return Object.fromEntries(GRADES.map((g) => [g.grade, formatWhen(now, preview[g.grade].card.due)])) as Record<Grade, string>
  }, [current])

  const reveal = useCallback(() => {
    playSound('flip')
    setRevealed(true)
  }, [])

  const rate = useCallback(
    async (grade: Grade) => {
      if (!current || !queue || record.isPending) return
      const now = new Date()
      const item = scheduler.next(toCard(current), now, grade)
      const { card, log } = toRecordPayload(item)
      try {
        await record.mutateAsync({ cardId: current.id, card, log, durationMs: Math.min(Date.now() - shownAt.current, 600_000) })
      } catch {
        return // el error se muestra en la barra; la tarjeta no avanza
      }
      const rest = queue.slice(1)
      const times = repeats.current.get(current.id) ?? 0
      if (grade === Rating.Again && times < MAX_REPEATS) {
        repeats.current.set(current.id, times + 1)
        // Vuelve unas tarjetas más adelante (no justo a continuación)
        rest.splice(Math.min(rest.length, 3), 0, { ...current, ...(card as unknown as SrsRow) })
      }
      setStats((s) => ({
        reviewed: s.reviewed + 1,
        again: s.again + (grade === Rating.Again ? 1 : 0),
        uniques: new Set(s.uniques).add(current.id),
      }))
      playSound(rest.length === 0 ? 'complete' : grade === Rating.Again ? 'again' : 'correct')
      setQueue(rest)
      setRevealed(false)
      shownAt.current = Date.now()
    },
    [current, queue, record],
  )

  // Teclado: espacio/Enter revela; 1–4 califica
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        reveal()
        return
      }
      const g = GRADES.find((x) => x.key === e.key)
      if (revealed && g) rate(g.grade)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, reveal, rate])

  if (isPending) return <FullScreenSpinner />
  if (isError) {
    return (
      <Centered>
        <h1 className="font-display text-title-2 font-semibold">No se pudo cargar tu repaso</h1>
        <Link to="/review" className={buttonClasses('primary', 'md')}>
          Volver
        </Link>
      </Centered>
    )
  }

  const done = stats.uniques.size
  const total = Math.max(initial?.length ?? 0, done)

  return (
    <div className="flex min-h-dvh flex-col bg-bg-grouped">
      {/* Barra superior: cerrar · progreso · contador */}
      <header className="glass-bar sticky top-0 z-30 border-b border-separator pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4 sm:px-6">
          <Link
            to="/review"
            aria-label="Terminar repaso (lo repasado ya está guardado)"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 transition-[background-color,color,transform] duration-150 ease-out hover:bg-fill hover:text-label active:scale-[0.97]"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-[1.8]">
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </Link>
          <div
            role="progressbar"
            aria-label="Progreso del repaso"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill"
          >
            <div
              className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${total ? done / total : 0})` }}
            />
          </div>
          <span className="shrink-0 text-callout font-semibold tabular-nums">
            {done}
            <span className="text-label-2">/{total}</span>
          </span>
        </div>
      </header>

      {!current ? (
        <Summary reviewed={stats.reviewed} unique={done} again={stats.again} />
      ) : (
        <>
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-[calc(11rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
            <div key={`${current.id}-${stats.reviewed}`} className="animate-card">
              <Flashcard item={current} revealed={revealed} />
            </div>
          </main>

          {/* Barra inferior (capa funcional) */}
          <div className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t border-separator pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6 sm:py-4">
              {record.isError && (
                <p role="alert" className="text-center text-footnote font-medium text-danger">
                  No se pudo guardar. Revisa tu conexión y vuelve a calificar.
                </p>
              )}
              {!revealed ? (
                <Button size="lg" onClick={reveal} className="w-full">
                  Mostrar respuesta
                </Button>
              ) : (
                <>
                  <p className="text-center text-footnote text-label-2">
                    ¿Qué tan bien la recordaste? Debajo ves cuándo te la volveremos a mostrar.
                  </p>
                  <div className="grid grid-cols-4 gap-2" role="group" aria-label="¿Qué tan bien la recordaste?">
                    {GRADES.map((g) => (
                      <button
                        key={g.grade}
                        type="button"
                        disabled={record.isPending}
                        onClick={() => rate(g.grade)}
                        aria-label={`${g.label}: ${g.hint}. Vuelve ${previews?.[g.grade] ?? ''}`}
                        className={cn(
                          'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-fill px-1 py-2 transition-[transform,background-color] duration-150 ease-out',
                          'hover:bg-[color-mix(in_srgb,var(--fill),var(--label)_6%)] active:scale-[0.96] disabled:opacity-60',
                        )}
                      >
                        <span className={cn('text-callout leading-tight font-semibold', g.tone)}>{g.label}</span>
                        <span className="text-[0.6875rem] leading-tight text-label-2">{g.hint}</span>
                        <span className="text-footnote leading-tight font-medium text-label tabular-nums">{previews?.[g.grade]}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="hidden text-center text-footnote text-label-2 sm:block">
                {revealed ? 'Teclas 1–4 para calificar' : 'Espacio para mostrar la respuesta'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Summary({ reviewed, unique, again }: { reviewed: number; unique: number; again: number }) {
  const recalled = reviewed ? Math.round(((reviewed - again) / reviewed) * 100) : 0
  if (!unique) {
    return (
      <Centered>
        <span className="flex size-16 items-center justify-center rounded-full bg-fill text-label-2">
          <CheckIcon className="size-8" />
        </span>
        <h1 className="font-display text-title-1 font-bold">Nada pendiente por ahora</h1>
        <p className="max-w-sm text-body text-label-2">Ya repasaste todo lo de hoy. Tus próximas tarjetas aparecerán cuando llegue su momento.</p>
        <Link to="/review" className={buttonClasses('primary', 'lg')}>
          Volver a Repaso
        </Link>
      </Centered>
    )
  }
  return (
    <Centered>
      <span className="animate-enter flex size-20 items-center justify-center rounded-full bg-success text-white">
        <CheckIcon className="size-10" />
      </span>
      <h1 className="animate-enter font-display text-[clamp(2rem,1.5rem+2vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em]">Repaso completado</h1>
      <dl className="animate-enter grid w-full max-w-md grid-cols-3 divide-x divide-separator rounded-[22px] bg-surface py-4">
        {[
          { label: 'Tarjetas', value: unique },
          { label: 'Recordadas', value: `${recalled}%` },
          { label: 'XP', value: `+${reviewed}` },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-0.5 px-2">
            <dt className="text-footnote text-label-2">{s.label}</dt>
            <dd className="text-title-1 font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="animate-enter flex w-full max-w-md flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Link to="/dashboard" className={buttonClasses('primary', 'lg', 'w-full sm:w-auto')}>
          Ver mi progreso
        </Link>
        <Link to="/review" className={buttonClasses('secondary', 'lg', 'w-full sm:w-auto')}>
          Volver a Repaso
        </Link>
      </div>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">{children}</div>
}
