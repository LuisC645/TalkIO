import { cn } from '@/lib/cn'

export type Variant = 'primary' | 'secondary' | 'plain'
export type Size = 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white active:bg-accent-press hover:bg-accent-press',
  secondary: 'bg-fill text-label hover:bg-[color-mix(in_srgb,var(--fill),var(--label)_6%)]',
  plain: 'bg-transparent text-link hover:underline underline-offset-4',
}

// 44px de alto mínimo (buttons.md › Best practices: hit region ≥ 44×44)
const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-5 text-callout',
  lg: 'min-h-12 px-6 text-body',
}

/** Clases del botón, reutilizables en enlaces que se ven como botón (<Link className={buttonClasses()} />) */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium',
    'transition-[transform,background-color] duration-[160ms] ease-out active:scale-[0.97]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}
