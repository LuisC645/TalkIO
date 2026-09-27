import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

const THUMB = 48 // px
const PAD = 4 // px de margen interno
const DONE_AT = 0.92 // porcentaje del recorrido para confirmar

/**
 * Deslizar para confirmar (acciones irreversibles): arrastra el círculo hasta el final. Si se
 * suelta antes, vuelve a su sitio. Con teclado: flechas para avanzar (5 pasos) o Inicio para
 * volver. El recorrido lento y deliberado evita confirmar por accidente.
 */
export function SlideToConfirm({
  label,
  onConfirm,
  loading,
  disabled,
}: {
  label: string
  onConfirm: () => void
  loading?: boolean
  disabled?: boolean
}) {
  const track = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; offset: number } | null>(null)
  const [offset, setOffset] = useState(0) // 0…max en px
  const [dragging, setDragging] = useState(false)
  const [done, setDone] = useState(false)
  const [width, setWidth] = useState(0)

  // Ancho del riel (cambia al rotar el móvil o redimensionar)
  useEffect(() => {
    const el = track.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const max = () => Math.max(1, width - THUMB - PAD * 2)
  const progress = done ? 1 : offset / max()
  const locked = disabled || loading || done

  function finish() {
    setDone(true)
    setOffset(max())
    onConfirm()
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (locked) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, offset }
    setDragging(true)
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!start.current) return
    setOffset(Math.min(max(), Math.max(0, start.current.offset + e.clientX - start.current.x)))
  }
  function onPointerUp() {
    if (!start.current) return
    start.current = null
    setDragging(false)
    if (offset / max() >= DONE_AT) finish()
    else setOffset(0) // vuelve a su sitio
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (locked) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(max(), offset + max() / 5)
      if (next / max() >= DONE_AT) finish()
      else setOffset(next)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'Escape') {
      e.preventDefault()
      setOffset(0)
    }
  }

  return (
    <div
      ref={track}
      className={cn(
        'relative h-14 w-full touch-none overflow-hidden rounded-full bg-danger/12 select-none',
        disabled && 'opacity-50',
      )}
    >
      {/* Relleno que acompaña al círculo */}
      <div
        aria-hidden
        className={cn('absolute inset-y-0 left-0 rounded-full bg-danger/25', !dragging && 'transition-[width] duration-300 ease-[var(--ease-drawer)]')}
        style={{ width: `calc(${PAD * 2 + THUMB}px + ${progress * max()}px)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-callout font-semibold text-danger transition-opacity duration-150"
        style={{ opacity: done ? 0 : Math.max(0, 1 - progress * 1.6) }}
      >
        {label}
      </span>
      <div
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label={`${label}. Usa la flecha derecha para avanzar.`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-disabled={locked || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          'absolute top-1 left-1 flex size-12 cursor-grab items-center justify-center rounded-full bg-danger text-white shadow-[0_2px_8px_rgb(0_0_0/0.2)] active:cursor-grabbing',
          !dragging && 'transition-transform duration-300 ease-[var(--ease-drawer)] motion-reduce:transition-none',
        )}
        style={{ transform: `translateX(${done ? max() : offset}px)` }}
      >
        {loading ? (
          <Spinner className="size-5" />
        ) : (
          <svg aria-hidden viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-2">
            <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
