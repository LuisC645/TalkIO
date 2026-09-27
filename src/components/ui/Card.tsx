import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type Props = ComponentProps<'div'> & {
  /** Con sombra (solo sobre fondos blancos, p. ej. la landing). En la app las superficies son planas. */
  elevated?: boolean
}

/**
 * Superficie agrupada estilo iOS (inset grouped): plana sobre el fondo agrupado, sin sombra.
 * Agrupa contenido relacionado; no es un adorno (layout.md › Group related items).
 */
export function Card({ className, elevated, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={cn('rounded-[22px] bg-surface', elevated && 'shadow-[var(--shadow-card)]', className)}
    />
  )
}
