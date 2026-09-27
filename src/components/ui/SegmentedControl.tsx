import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Option<T extends string> = {
  value: T
  label: string
  /** Si hay icono, se muestra solo el icono y `label` queda como nombre accesible y tooltip */
  icon?: ReactNode
}

type Props<T extends string> = {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Segmented control (segmented-controls.md): segmentos de igual ancho; solo texto o solo iconos.
 * La pastilla seleccionada se desliza con transform (200ms, ease-out fuerte) → interrumpible.
 * Accesible como radiogroup; flechas izquierda/derecha cambian la selección.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange, size = 'md', className }: Props<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  function onKeyDown(e: KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('relative grid rounded-[10px] bg-fill p-0.5', size === 'sm' && 'rounded-full', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0.5 left-0.5 bg-thumb shadow-[0_1px_2px_rgb(0_0_0/0.12),0_2px_6px_rgb(0_0_0/0.06)]',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          size === 'sm' ? 'rounded-full' : 'rounded-[8px]',
        )}
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option, i) => {
        const selected = i === index
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.icon ? option.label : undefined}
            title={option.icon ? option.label : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 flex items-center justify-center transition-colors duration-150',
              size === 'sm' ? 'size-9 rounded-full' : 'min-h-9 rounded-[8px] px-3 text-callout',
              selected ? 'font-semibold text-label' : 'font-medium text-label-2 hover:text-label',
            )}
          >
            {option.icon ?? option.label}
          </button>
        )
      })}
    </div>
  )
}
