import type { ReactNode } from 'react'

/** Encabezado de panel lateral (amigos, notificaciones): título, resumen, acción y cerrar. */
export function PanelHeader({
  title,
  subtitle,
  action,
  onClose,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  onClose?: () => void
}) {
  return (
    <div className="flex items-start gap-3 px-5 pt-5 pb-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-title-2 font-bold tracking-[-0.02em]">{title}</h2>
        {subtitle && <p className="text-footnote text-label-2">{subtitle}</p>}
      </div>
      {action}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={`Cerrar ${title.toLowerCase()}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 transition-transform duration-150 ease-out hover:text-label active:scale-[0.96]"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="size-4 fill-none stroke-current stroke-2">
            <path d="m6 6 8 8M14 6l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
