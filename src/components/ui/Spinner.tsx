import { cn } from '@/lib/cn'

type Props = { className?: string; label?: string }

export function Spinner({ className, label = 'Cargando' }: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block size-5 animate-spin-fast rounded-full border-2 border-current border-r-transparent motion-reduce:animate-[spin-fast_1.2s_linear_infinite]',
        className,
      )}
    />
  )
}
