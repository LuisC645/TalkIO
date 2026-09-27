import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { buttonClasses, type Size, type Variant } from './buttonClasses'
import { Spinner } from './Spinner'

type Props = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

/**
 * Presión: scale(0.97) en 160ms ease-out (emil-design-eng › Buttons must feel responsive).
 * Hover: Tailwind v4 ya lo limita a dispositivos con puntero (@media (hover: hover)).
 */
export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
    >
      {/* El texto se mantiene (con opacidad 0) para que el botón no cambie de ancho */}
      <span className={cn('transition-opacity duration-150', loading && 'opacity-0')}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-[18px]" label="Procesando" />
        </span>
      )}
    </button>
  )
}
