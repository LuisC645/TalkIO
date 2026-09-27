import { useAppearanceStore, type Appearance } from '@/stores/appearanceStore'
import { SegmentedControl } from './SegmentedControl'

const iconProps = { 'aria-hidden': true, viewBox: '0 0 20 20', className: 'size-[18px]' } as const

const OPTIONS: { value: Appearance; label: string; icon: React.ReactNode }[] = [
  {
    value: 'system',
    label: 'Automático (según el sistema)',
    icon: (
      <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="10" cy="10" r="6.5" />
        <path d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    value: 'light',
    label: 'Claro',
    icon: (
      <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 2.2v1.9M10 15.9v1.9M17.8 10h-1.9M4.1 10H2.2M15.5 4.5l-1.3 1.3M5.8 14.2l-1.3 1.3M15.5 15.5l-1.3-1.3M5.8 5.8 4.5 4.5" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Oscuro',
    icon: (
      <svg {...iconProps} fill="currentColor">
        <path d="M16.6 12.6A7 7 0 0 1 7.4 3.4a.5.5 0 0 0-.66-.6 7.5 7.5 0 1 0 10.46 10.46.5.5 0 0 0-.6-.66Z" />
      </svg>
    ),
  },
]

/**
 * Selector de apariencia. Por defecto sigue al sistema (dark-mode.md recomienda no forzar un
 * ajuste propio); Claro/Oscuro quedan como opción explícita.
 */
export function AppearanceControl({ className }: { className?: string }) {
  const appearance = useAppearanceStore((s) => s.appearance)
  const setAppearance = useAppearanceStore((s) => s.setAppearance)

  return (
    <SegmentedControl
      size="sm"
      label="Apariencia"
      value={appearance}
      onChange={setAppearance}
      options={OPTIONS}
      className={className}
    />
  )
}
