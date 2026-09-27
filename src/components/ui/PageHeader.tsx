import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  title: string
  eyebrow?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Título grande de pantalla (toolbars.md › "Use a large title to help people stay oriented").
 * En móvil, al hacer scroll, AppLayout muestra el mismo título en tamaño compacto arriba.
 */
export function PageHeader({ title, eyebrow, subtitle, actions, className }: Props) {
  return (
    <header className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-callout font-medium text-label-2 first-letter:uppercase">{eyebrow}</p>}
        <h1 className="font-display text-[2.125rem] leading-[1.12] font-bold tracking-[-0.03em] text-balance md:text-[2.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-body text-label-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-col gap-2.5 sm:flex-row md:shrink-0">{actions}</div>}
    </header>
  )
}

/** Encabezado de sección: fuera de la superficie, como en las apps de Apple */
export function SectionHeader({ title, detail, className }: { title: string; detail?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 px-1', className)}>
      <h2 className="text-title-2 font-bold tracking-[-0.02em]">{title}</h2>
      {detail && <div className="text-footnote text-label-2">{detail}</div>}
    </div>
  )
}
