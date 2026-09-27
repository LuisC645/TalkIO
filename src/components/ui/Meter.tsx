import { cn } from '@/lib/cn'

type Props = {
  value: number
  max: number
  label: string
  className?: string
}

/**
 * Proporción contra un límite (dataviz › Meter): el relleno en acento y la pista en un paso
 * más claro del mismo tono, para que el estado se lea a lo largo de toda la barra.
 * El ancho se anima con transform (scaleX), no con width.
 */
export function Meter({ value, max, label, className }: Props) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn('h-2 overflow-hidden rounded-full bg-accent/15 dark:bg-accent/30', className)}
    >
      <div
        className="h-full origin-left rounded-full bg-accent transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${ratio})` }}
      />
    </div>
  )
}
