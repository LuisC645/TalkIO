import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

// Errores reales del diagnóstico (docs/user_seed.md)
const EXAMPLES = [
  {
    tag: 'Pasado al narrar',
    before: 'Last summer I ',
    wrong: 'go',
    right: 'went',
    after: ' to Paris with my family.',
    rule: 'Si ya pasó, el verbo va en pasado.',
  },
  {
    tag: 'Falso amigo',
    before: 'Next year I want to finish my ',
    wrong: 'career',
    right: 'degree',
    after: '.',
    rule: 'Carrera universitaria es degree; career es tu trayectoria profesional.',
  },
  {
    tag: 'Colocación',
    before: 'Every morning I ',
    wrong: 'clean',
    right: 'brush',
    after: ' my teeth before class.',
    rule: 'Con los dientes se usa brush, no clean.',
  },
] as const

const SHOW_WRONG_MS = 1100
const HOLD_FIXED_MS = 3400

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Elemento distintivo de la landing: una corrección "de profesor" sobre un error real.
 * La palabra equivocada se tacha (línea que crece de izquierda a derecha) y la correcta
 * aparece encima, como escrita a mano en el margen.
 *
 * Movimiento (emil-design-eng): transiciones CSS (interrumpibles), solo transform/opacity/filter,
 * ease-in-out para el trazo en pantalla y ease-out para la entrada. Se pausa con la pestaña oculta
 * y al pasar el puntero o enfocar. Con movimiento reducido: sin avance automático ni trazo animado.
 */
export function CorrectionDemo({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [phaseFixed, setFixed] = useState(false)
  const [paused, setPaused] = useState(false)
  const [hidden, setHidden] = useState(document.hidden)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Con movimiento reducido la corrección se muestra siempre, sin avance automático
  const fixed = reduced || phaseFixed

  useEffect(() => {
    if (reduced || paused || hidden) return
    const t = window.setTimeout(
      () => {
        if (!phaseFixed) setFixed(true)
        else {
          setFixed(false)
          setIndex((i) => (i + 1) % EXAMPLES.length)
        }
      },
      phaseFixed ? HOLD_FIXED_MS : SHOW_WRONG_MS,
    )
    return () => window.clearTimeout(t)
  }, [phaseFixed, index, paused, hidden, reduced])

  function select(i: number) {
    setIndex(i)
    setFixed(false)
  }

  const ex = EXAMPLES[index]

  return (
    <Card
      elevated
      ref={rootRef}
      className={cn('p-6 sm:p-7', className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setPaused(false)
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-footnote font-medium text-label-2">De tu diagnóstico</span>
        <span
          className={cn(
            'rounded-full bg-fill px-2.5 py-1 text-footnote font-medium text-label',
            'transition-opacity duration-200 ease-out',
            fixed ? 'opacity-100' : 'opacity-0',
          )}
        >
          {ex.tag}
        </span>
      </div>

      {/* key → cada ejemplo entra con un fundido corto */}
      <p key={index} className="animate-page mt-6 font-display text-title-2 font-medium leading-[2.6] sm:text-[1.625rem] sm:leading-[2.3]">
        {ex.before}
        <span className="relative inline-block whitespace-nowrap leading-tight">
          <span className={cn('transition-colors duration-300', fixed ? 'text-label-2' : 'text-label')}>{ex.wrong}</span>
          {/* Tachado: crece desde la izquierda */}
          <span
            aria-hidden
            className={cn(
              'absolute top-1/2 -right-0.5 -left-0.5 h-[2.5px] origin-left rounded-full bg-danger',
              'transition-transform duration-[350ms] ease-in-out motion-reduce:transition-none',
              fixed ? 'scale-x-100' : 'scale-x-0',
            )}
          />
          {/* Corrección encima, como en el margen */}
          <span
            className={cn(
              'absolute bottom-full left-1/2 -translate-x-1/2 pb-0.5 font-semibold text-success',
              'transition-[opacity,filter,translate] duration-300 ease-out motion-reduce:transition-none',
              fixed ? 'opacity-100 blur-0 delay-[250ms]' : 'translate-y-1 opacity-0 blur-[4px] delay-0 duration-100',
            )}
          >
            {ex.right}
          </span>
        </span>
        {ex.after}
      </p>
      <span className="sr-only">
        Corrección: {ex.wrong} → {ex.right}.
      </span>

      <p className={cn('mt-4 min-h-[2.8em] text-callout text-label-2 transition-opacity duration-200', fixed ? 'opacity-100' : 'opacity-0')}>
        {ex.rule}
      </p>

      <div className="mt-5 flex items-center gap-1" role="group" aria-label="Ejemplos">
        {EXAMPLES.map((e, i) => (
          <button
            key={e.tag}
            type="button"
            aria-label={`Ejemplo ${i + 1}: ${e.tag}`}
            aria-pressed={i === index}
            onClick={() => select(i)}
            className="group flex size-7 items-center justify-center"
          >
            <span
              className={cn(
                'h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out',
                i === index ? 'w-5 bg-label' : 'w-1.5 bg-label-3 group-hover:bg-label-2',
              )}
            />
          </button>
        ))}
      </div>
    </Card>
  )
}
