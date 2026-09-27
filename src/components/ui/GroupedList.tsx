import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Lista agrupada estilo iOS (inset grouped): filas con separador fino que no llega al borde
 * izquierdo, encabezado y pie de sección fuera de la superficie (lists-and-tables.md › Style).
 */
export function GroupedList({
  header,
  footer,
  children,
  className,
}: {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      {header && <h2 className="px-4 text-footnote font-medium text-label-2">{header}</h2>}
      <ul className="overflow-hidden rounded-[22px] bg-surface">{children}</ul>
      {footer && <p className="px-4 text-footnote text-label-2">{footer}</p>}
    </section>
  )
}

export function Row({
  label,
  detail,
  leading,
  trailing,
  children,
  className,
}: {
  label?: ReactNode
  detail?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <li className={cn('group/row relative flex min-h-12 items-center gap-3 px-4 py-2.5', className)}>
      {leading}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        {children ?? (
          <>
            <span className="min-w-0 text-body">{label}</span>
            {detail != null && <span className="shrink-0 text-body text-label-2">{detail}</span>}
          </>
        )}
      </div>
      {trailing}
      {/* Separador: empieza donde empieza el texto, se oculta en la última fila */}
      <span aria-hidden className="absolute right-0 bottom-0 left-4 h-px bg-separator group-last/row:hidden" />
    </li>
  )
}
