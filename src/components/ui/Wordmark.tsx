import { cn } from '@/lib/cn'

/** Marca: dos burbujas de conversación superpuestas (hablar ↔ corregir). */
export function Wordmark({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cn(
        // translate-y: compensación óptica; "TalkIO" no tiene descendentes y se ve alto aunque esté centrado
        'inline-flex translate-y-[2px] items-center font-display leading-none font-semibold tracking-[-0.02em]',
        size === 'lg' ? 'gap-2.5 text-[1.375rem]' : 'gap-2 text-[1.1875rem]',
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 24 24" className={cn('shrink-0', size === 'lg' ? 'size-7' : 'size-6')}>
        <rect x="2" y="4" width="14" height="11" rx="5.5" className="fill-accent" />
        <rect x="8" y="9" width="14" height="11" rx="5.5" className="fill-label" opacity="0.9" />
      </svg>
      TalkIO
    </span>
  )
}
