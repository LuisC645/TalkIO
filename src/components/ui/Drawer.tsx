import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

const CLOSE_MS = 240

/**
 * Cajón (Liquid Glass grueso): sube desde abajo en móvil y entra por la derecha desde md.
 * Se cierra con el botón del contenido, tocando fuera o con Escape; la salida es más corta
 * que la entrada. `children` recibe `dismiss` para cerrar con animación.
 */
export function Drawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
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
      <div data-closing={closing || undefined} onClick={dismiss} className="backdrop absolute inset-0 bg-black/30" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-closing={closing || undefined}
        className={cn(
          'drawer glass-thick absolute flex flex-col overflow-hidden outline-none',
          // móvil: hoja inferior con asa que continúa 48px bajo el borde de la pantalla (sin borde
          // ni barra visible abajo, también tras la barra de Safari); misma altura visible (85dvh)
          'inset-x-0 -bottom-12 max-h-[calc(85dvh+3rem)] rounded-t-[28px] max-md:!border-x-0 max-md:!border-b-0 pb-[calc(3rem+env(safe-area-inset-bottom))]',
          'md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:max-h-none md:w-[24rem] md:rounded-[28px] md:pb-0',
        )}
      >
        <span aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-label-3/50 md:hidden" />
        {children(dismiss)}
      </div>
    </div>,
    document.body,
  )
}
