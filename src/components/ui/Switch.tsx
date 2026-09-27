import { cn } from '@/lib/cn'

/** Interruptor estilo iOS (toggles.md): pista verde al activarse, perilla que se desliza con transform. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ease-out disabled:opacity-50',
        checked ? 'bg-success' : 'bg-fill',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.18)] transition-transform duration-200 ease-out motion-reduce:transition-none',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}
