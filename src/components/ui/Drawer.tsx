import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

const CLOSE_MS = 240

/**
 * Panel (Liquid Glass grueso): en móvil, tarjeta flotante que nace del botón que la abre;
 * desde md, cajón que entra por la derecha.
 * Se cierra con el botón del contenido, tocando fuera o con Escape; la salida es más corta
 * que la entrada. `children` recibe `dismiss` para cerrar con animación.
 */
export function Drawer({
  open,
  onClose,
  label,
  origin = 'top center',
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  /** Móvil: punto desde el que nace la tarjeta (el botón que la abre), p. ej. "30px 16px" */
  origin?: string
  children: (dismiss: () => void) => ReactNode
}) {
  const [closing, setClosing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const dismiss = () => setClosing(true)

  // Al terminar la animación de salida, se cierra de verdad
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    if (!closing) return
    const t = window.setTimeout(() => {
      setClosing(false)
      onCloseRef.current()
    }, CLOSE_MS)
    return () => window.clearTimeout(t)
  }, [closing])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setClosing(true)
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div data-closing={closing || undefined} onClick={dismiss} className="backdrop absolute inset-0 bg-black/25 backdrop-blur-[3px]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-closing={closing || undefined}
        className={cn(
          'drawer glass-thick absolute flex flex-col overflow-hidden outline-none',
          // móvil: tarjeta flotante con margen arriba (16px) y a los lados (12px), esquinas redondeadas
          'inset-x-3 top-[calc(env(safe-area-inset-top)+1rem)] max-h-[calc(88dvh-env(safe-area-inset-top))] rounded-[28px]',
          'md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:max-h-none md:w-[24rem]',
        )}
        style={{ '--drawer-origin': origin } as CSSProperties}
      >
        {children(dismiss)}
      </div>
    </div>,
    document.body,
  )
}
