import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'

type Word = { text: string; tone?: 'success' | 'accent' }

// Inglés general que se corrige a diario (pasados irregulares, contracciones, expresiones
// frecuentes). Algunas llevan el color de "correcto" para que el vidrio tenga color que refractar.
const ROWS: Word[][] = [
  [{ text: 'went', tone: 'success' }, { text: 'thought' }, { text: 'brought' }, { text: 'I’m' }, { text: 'bought', tone: 'accent' }, { text: 'taught' }],
  [{ text: 'look forward to' }, { text: 'make sense', tone: 'accent' }, { text: 'last week' }, { text: 'I would rather' }],
  [{ text: 'anything else' }, { text: 'a lot of people', tone: 'success' }, { text: 'don’t' }, { text: 'by the way' }],
  [{ text: 'I have been' }, { text: 'as soon as' }, { text: 'although', tone: 'accent' }, { text: 'since 2019' }],
  [{ text: 'take a break' }, { text: 'every morning', tone: 'success' }, { text: 'in the evening' }, { text: 'used to' }],
  [{ text: 'has been' }, { text: 'I’d like to', tone: 'accent' }, { text: 'enough time' }, { text: 'nevertheless' }, { text: 'yet' }],
  [{ text: 'make a decision' }, { text: 'on the other hand' }, { text: 'I have lived', tone: 'success' }, { text: 'on weekends' }],
  [{ text: 'better than' }, { text: 'get used to' }, { text: 'whose', tone: 'accent' }, { text: 'I didn’t know' }, { text: 'unless' }],
]

// Duración de una vuelta por fila (s): distintas para que no se muevan en bloque
const DURATIONS = [150, 190, 130, 210, 170, 140, 200, 160]

/**
 * Fondo de la pantalla de acceso (capa de contenido, sin vidrio): inglés corregido pasando en
 * horizontal, muy tenues. Las filas alternan sentido y velocidad; su número se ajusta a la altura
 * de la sección (la tarjeta de registro es más alta que la de inicio de sesión). Solo se anima
 * transform (GPU) y muy despacio; con "reducir movimiento" queda quieto.
 */
export function CorrectionWall({ className }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState(ROWS.length)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const first = el.querySelector<HTMLElement>('[data-wall-row]')
      const rowH = (first?.offsetHeight ?? 80) + parseFloat(getComputedStyle(el.lastElementChild as HTMLElement).rowGap || '0')
      setRows(Math.min(24, Math.max(ROWS.length, Math.ceil(el.clientHeight / Math.max(40, rowH)) + 1)))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={box}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden select-none',
        // Se desvanece arriba/abajo; en escritorio además a la izquierda, donde va el texto
        '[mask-image:linear-gradient(to_bottom,transparent,black_14%,black_80%,transparent)]',
        'lg:[mask-image:linear-gradient(to_bottom,transparent,black_14%,black_80%,transparent),linear-gradient(to_right,transparent_28%,black_56%)] lg:[mask-composite:intersect]',
        className,
      )}
    >
      {/* Luz ambiental con los colores de corrección, detrás del panel de acceso */}
      <div className="absolute inset-0 bg-[radial-gradient(38%_48%_at_78%_46%,color-mix(in_srgb,var(--accent)_24%,transparent),transparent_72%),radial-gradient(32%_40%_at_12%_88%,color-mix(in_srgb,var(--success)_16%,transparent),transparent_70%)]" />
      <div className="absolute inset-0 flex flex-col justify-center gap-[2vh]">
        {Array.from({ length: rows }, (_, i) => {
          const words = ROWS[i % ROWS.length]
          const style = {
            '--wall-duration': `${DURATIONS[i % DURATIONS.length]}s`,
            // Cada fila arranca en un punto distinto de su recorrido
            animationDelay: `-${(i * 37) % 120}s`,
            animationDirection: i % 2 ? 'reverse' : 'normal',
          } as CSSProperties
          return (
            <div key={i} data-wall-row className="wall-row flex w-max" style={style}>
              {/* Dos copias seguidas: al llegar a la mitad, el recorrido empalma sin salto */}
              {[0, 1].map((copy) => (
                <p key={copy} className="shrink-0 pr-[0.45em] font-display text-[clamp(3.25rem,7.5vw,8rem)] leading-none font-bold tracking-[-0.04em] whitespace-nowrap">
                  {words.map((w, j) => (
                    <span
                      key={j}
                      className={cn(
                        'mr-[0.45em]',
                        w.tone === 'success' && 'text-success/15 dark:text-success/25',
                        w.tone === 'accent' && 'text-accent/15 dark:text-accent/35',
                        !w.tone && 'text-label/[0.035] dark:text-label/[0.055]',
                      )}
                    >
                      {w.text}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
